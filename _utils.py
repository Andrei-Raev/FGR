from datetime import datetime
from typing import Optional
from uuid import uuid4

import bs4
import requests
from fastapi import HTTPException

from database import QuestionText


def auth(login: str, password: str) -> str:
    """
    Берет логин и пароль и возвращает некий `SID`, который является cookie.
    `SID` - идентификатор сессии, 32 символа
    :param login: Логин аккаунта
    :param password: Пароль от аккаунта
    :return: SID=xxx
    """
    _resp = requests.get('https://in.3level.ru/?module=login')
    _SID = _resp.cookies.get_dict()['SID']

    _headers = {
        'Cookie': f'SID={_SID}'
    }

    _data = {
        'user_login': login,
        'user_password': password
    }

    requests.post('https://in.3level.ru/?module=login', headers=_headers, data=_data)

    return _SID


def test_auth(sid: str) -> Optional[str]:
    _headers = {
        'Cookie': f'SID={sid}'
    }

    _resp = requests.get('https://in.3level.ru/', headers=_headers)

    soup = bs4.BeautifulSoup(_resp.text, 'html.parser')
    _title = soup.find('title').text

    return _title


def check_status(sid: str) -> bool:
    _headers = {
        'Cookie': f'SID={sid}'
    }

    _resp = requests.get('https://in.3level.ru/?module=testing', headers=_headers)

    soup = bs4.BeautifulSoup(_resp.text, 'html.parser')
    _title = soup.find('title').text

    return 'Тестирование' not in _title


def parse_result(html):
    soup = bs4.BeautifulSoup(html, 'html.parser')

    # Извлекаем Статистику
    statistics_table = soup.find('h2', text='Статистика').find_next('table')
    statistics_rows = statistics_table.find_all('tr')
    statistics = {}

    for row in statistics_rows:
        cols = row.find_all('td')
        if len(cols) == 2:
            parameter = cols[0].get_text(strip=True)
            value = cols[1].get_text(strip=True)
            statistics[parameter] = value

    # Извлекаем Рейтинг
    rating_table = soup.find('h2', text='Рейтинг').find_next('table')
    rating_rows = rating_table.find_all('tr')[1:]  # Пропустить заголовок
    ratings = []

    for row in rating_rows:
        cols = row.find_all('td')
        if len(cols) == 3:
            rank = cols[0].get_text(strip=True)
            info = cols[1].get_text(strip=True)
            score = cols[2].get_text(strip=True)
            rating_entry = {
                'rank': rank,
                'info': info,
                'score': score
            }
            ratings.append(rating_entry)

    return {'statistics': statistics, "ratings": ratings, 'is_it_result_page': True}


def _parse_page(sid: str, is_html: bool = False) -> dict:
    if not is_html:
        _headers = {
            'Cookie': f'SID={sid}'
        }
        text = requests.get('https://in.3level.ru/?module=testing', headers=_headers).text
    else:
        text = sid

    # _save_page_to_file(text, 'tmp_htmls/rr/fls')

    soup = bs4.BeautifulSoup(text, 'html.parser')
    if 'Просмотр результатов' in soup.find('title').text:
        return parse_result(text)
    elif 'Вопрос' not in soup.find('title').text:
        print(soup.find('title').text)
        # 400 error fast api response
        raise HTTPException(status_code=400, detail="Bad request")

    res = dict()
    res['is_it_result_page'] = False

    is_success = soup.find('div', {'class': 'alert-success'}) is not None
    res['is_last_success'] = is_success

    q_numm = int(soup.find('h2').text.split()[1])
    res['question_number'] = q_numm

    # question template {"text": "", "img": "", "answers": [{"text": "", "num": int}]}
    res['text'] = list()
    res['img'] = list()

    question = soup.find('div', {'class': 'col-md-12'})
    if not question:
        question = soup.find('p', {'class': 'rvps0'})
    for i in question.children:
        if i:
            if i.name == 'p':
                ti = i
                i = i.find('span')
                if not i:
                    i = ti.find('img')
                if not i:
                    continue
            if i.name == 'span':
                res['text'].append(i.text)
            elif i.name == 'img':
                res['img'].append('https://in.3level.ru/' + i['src'])
    # find element with name current_question
    current_question = soup.find('input', {'name': 'current_question'}).get('value')

    res['current_question_number'] = int(current_question)

    answers = soup.find('table', {'class': 'table table-hover'})
    tt_res = []
    mult_answer = False
    for i in answers.children:
        if i != '\n':
            ttt = i.find('td', {'width': '70'}).find('input')
            if ttt.get('type') == 'checkbox':
                mult_answer = True
            nm = ttt.get('value')
            tt = i.text.strip().split('\n')[1]
            tmp = {"text": tt, "num": int(nm)}
            tt_res.append(tmp)
    res['answers'] = sorted(tt_res, key=lambda x: x['num'])
    res['mult_answer'] = mult_answer


    info = soup.find('div', {'class': 'alert alert-info'})
    ch_info = info.children
    ch_info.__next__()
    res["total_questions"] = int(ch_info.__next__().find('strong').text)
    ch_info.__next__()
    try:
        res["current_questions"] = int(ttttt:=ch_info.__next__().find('strong').text)
    except Exception:
        res["current_questions"] = ttttt
    ch_info.__next__()
    ch_info.__next__()
    ch_info.__next__()
    try:
        res["time_left"] = datetime.strptime(ch_info.__next__().find('strong').text, '%H:%M:%S')
    except Exception:
        res['time_left'] = datetime.strptime("0:20:00", '%H:%M:%S')
    return res


class TestList:
    AAP_STYLE = {'section_id': 1, 'test_id': 19}
    AAP_2024 = {'section_id': 1, 'test_id': 30}
    AAP_KURS = {'section_id': 1, 'test_id': 39}
    OPPR_2024 = {'section_id': 3, 'test_id': 37}


def _start_test(sid: str, section_id: int, test_id: int) -> bool:
    _headers = {
        'Cookie': f'SID={sid}'
    }

    _url = 'http://in.3level.ru/?module=testing'
    _data = {
        'section_id': section_id,
        'test_id': test_id,
        'submit_button': 'Выбрать'
    }

    return requests.post(_url, headers=_headers, data=_data).status_code == 200


def _answer_question(sid: str, question_index: int, answer: int) -> dict:
    _headers = {
        'Cookie': f'SID={sid}'
    }

    _url = 'http://in.3level.ru/?module=testing'

    answer = decode_answer(answer)
    if isinstance(answer, int):
        _data = {
            'current_question': question_index,
            'answer': answer,
            'submit_button': 'Ответить'
        }
    else:
        _data = {
            'current_question': question_index,
            'submit_button': 'Ответить'
        }
        for i in answer:
            _data[f'answer[{i}]'] = f'{i}'

    return _parse_page(requests.post(_url, headers=_headers, data=_data).text, is_html=True)


def encode_answer(answers):
    """
    Функция кодирует ответ в одно целое число.
    :param answers: Если это единственный индекс, возвращает его. Если список, возвращает отрицательное число.
    :return: Целое число, представляющее закодированный ответ.
    """
    if isinstance(answers, int):
        return answers

    if isinstance(answers, (list, tuple)):
        encoded = 0
        for answer in answers:
            encoded |= 1 << answer
        return -encoded  # Используем отрицательное значение для маркировки нескольких ответов

    raise ValueError("Аргумент должен быть целым числом или списком/кортежем.")


def decode_answer(encoded):
    """
    Функция декодирует закодированный ответ.
    :param encoded: Целое число, представляющее закодированный ответ.
    :return: Индекс (для одиночного ответа) или список индексов (для множественного ответа).
    """
    if encoded >= 0:
        # Это одиночный ответ
        return encoded

    # Это множественный ответ, закодированный отрицательным числом
    encoded = -encoded  # Возвращаемся к положительному для декодирования

    answers = []
    index = 0
    while encoded > 0:
        if encoded & 1:  # Проверяем, установлен ли текущий бит
            answers.append(index)
        encoded >>= 1  # Сдвигаем значение вправо на один бит
        index += 1

    return answers


def _save_page_to_file(text: str, filename: str):
    # _headers = {
    #     'Cookie': f'SID={sid}'
    # }

    uuid = str(uuid4())
    filename = f'{filename}_{uuid}.html'

    # r = requests.get('https://in.3level.ru/?module=testing', headers=_headers)
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(text)


def save_question_to_db(question_id: int, text: str, answers: list[dict[str, str]], test_id: int, session) -> None:
    q = session.query(QuestionText).filter(QuestionText.question_index == question_id).first()
    if q:
        return

    q = QuestionText(question_index=question_id, text=text, answers=answers, test_id=test_id)
    session.add(q)
    session.commit()
