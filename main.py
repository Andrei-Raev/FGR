from fastapi import FastAPI, Request, Form
from fastapi.templating import Jinja2Templates
from starlette.responses import RedirectResponse, JSONResponse
from starlette.staticfiles import StaticFiles

from _utils import auth, test_auth, check_status, _parse_page, _start_test, _answer_question, TestList, \
    save_question_to_db
from database import Session, Question

templates = Jinja2Templates(directory="templates")

app = FastAPI()

app.mount('/static', StaticFiles(directory='static', html=True), name='static')


@app.get("/favicon.ico")
def favicon():
    return RedirectResponse("/static/favicon.ico", status_code=302)


@app.get("/")
async def root(request: Request):
    if not request.cookies.get('SID'):
        return RedirectResponse("/login", status_code=302)
    elif not (username := test_auth(request.cookies.get('SID'))):
        return RedirectResponse("/login", status_code=302)

    data = {"request": request,
            "username": username.split('@')[0].strip()}

    return templates.TemplateResponse('main.html', data)


@app.get("/login")
async def root(request: Request):
    return templates.TemplateResponse('login.html', {"request": request})


@app.post("/login")
async def post_login(request: Request):
    form_data = await request.form()
    login = form_data['username']
    password = form_data['password']

    auth_cookie = auth(login, password)

    # 40 mins expires
    headers = {'Set-Cookie': f"SID={auth_cookie}; max-age={60 * 60 * 40}; path=/"}

    return RedirectResponse("/", status_code=302, headers=headers)


@app.get("/status")
async def get_status(request: Request):
    if not request.cookies.get('SID'):
        return RedirectResponse("/login", status_code=302)
    elif not test_auth(request.cookies.get('SID')):
        return RedirectResponse("/login", status_code=302)

    test_id = int(request.cookies.get('test_id') or 0)

    with Session() as session:
        in_base = session.query(Question).where(Question.test_id == test_id).count()

    return {"status": check_status(request.cookies.get('SID')), "in_base": in_base}


@app.get('/question')
async def get_question(request: Request):
    if not request.cookies.get('SID'):
        return RedirectResponse("/login", status_code=302)

    data = _parse_page(request.cookies.get('SID'))
    if data['is_it_result_page']:
        return data

    question_text = '\n'.join(data['text'])
    question_img = '\n'.join(data['img'])

    # hash_object = hashlib.sha256()
    # hash_object.update((question_text + question_img).encode('utf-8'))
    # t_hash = hash_object.hexdigest()

    question_index = data['current_question_number']

    with Session() as session:
        known_answer = session.query(Question).filter(Question.question_index == question_index).first()

        if known_answer:
            known_answer = known_answer.correct_answer
            tmp = _answer_question(request.cookies.get('SID'), question_index, known_answer)
            if tmp['is_it_result_page']:
                return tmp

    res = dict()
    res['auto'] = True if known_answer else False
    res['time_left'] = data['time_left'].strftime('%M:%S')
    res['question_text'] = question_text
    res['question_img'] = data['img']
    res['total_questions'] = data['total_questions']
    res['answers'] = data['answers']
    res['question_number'] = data['question_number']
    res['correct_answers'] = data['current_questions']
    res['total_answers'] = data['total_questions']
    res['is_it_result_page'] = data['is_it_result_page']

    test_id = int(request.cookies.get('test_id') or 0)

    with Session() as session:
        save_question_to_db(question_id=question_index, test_id=test_id, answers=data['answers'],
                            session=session,
                            text=question_text + ((';' + question_img) if question_img else ''))

    return res


@app.post('/question')
async def post_question(request: Request, answer: int = Form(...)):
    if not request.cookies.get('SID'):
        return RedirectResponse("/login", status_code=302)
    elif not test_auth(request.cookies.get('SID')):
        return RedirectResponse("/login", status_code=302)

    answer = int(answer)
    # get from cookie
    test_id = int(request.cookies.get('test_id') or 0)

    data = _parse_page(request.cookies.get('SID'))
    # print(data)
    if data['is_it_result_page']:
        return data

    question_img = '\n'.join(data['img'])
    question_text = '\n'.join(data['text'])
    # hash_object = hashlib.sha256()
    # hash_object.update((question_text + question_img).encode('utf-8'))
    # t_hash = hash_object.hexdigest()

    question_index = data['current_question_number']
    data = _answer_question(request.cookies.get('SID'), question_index, answer)
    if data['is_it_result_page']:
        return data

    if data['is_last_success']:
        with Session() as session:
            session.add(
                Question(question_index=question_index, correct_answer=answer, test_id=test_id))
            session.commit()

    time_left = data['time_left'].strftime('%M:%S')

    res = await get_question(request)
    res['time_left'] = time_left
    res['is_last_success'] = data['is_last_success']
    res['is_it_result_page'] = data['is_it_result_page']
    return res


@app.post("/start_test")
async def start_test(request: Request):
    if not request.cookies.get('SID'):
        return RedirectResponse("/login", status_code=302)
    elif not test_auth(request.cookies.get('SID')):
        return RedirectResponse("/login", status_code=302)

    test_id = await get_test_id((await request.json()).get('test_id'))

    _start_test(request.cookies.get('SID'), **test_id)

    headers = {'Set-Cookie': f"test_id={test_id.get('test_id')}"}
    response = JSONResponse(content={"status": check_status(request.cookies.get('SID'))}, headers=headers)

    return response


async def get_test_id(test_type: str) -> dict[str, int]:
    match test_type:
        case 'AAP_2024':
            test_id = TestList.AAP_2024
        case 'AAP_KURS':
            test_id = TestList.AAP_KURS
        case 'AAP_STYLE':
            test_id = TestList.AAP_STYLE
        case 'OPPR_2024':
            test_id = TestList.OPPR_2024
        case _:
            test_id = {'test_id': 0, 'section_id': 0}
    return test_id
