from datetime import datetime
from typing import Optional

import requests
import bs4


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


def _parse_page(sid: str, is_html: bool = False) -> dict:
    if not is_html:
        _headers = {
            'Cookie': f'SID={sid}'
        }
        text = requests.get('https://in.3level.ru/?module=testing', headers=_headers).text
    else:
        text = sid

    soup = bs4.BeautifulSoup(text, 'html.parser')
    if 'Вопрос' not in soup.find('title').text:
        return dict()

    res = dict()

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
    for i in answers.children:
        if i != '\n':
            nm = i.find('td', {'width': '70'}).find('input').get('value')
            tt = i.text.strip().split('\n')[1]
            tmp = {"text": tt, "num": int(nm)}
            tt_res.append(tmp)
    res['answers'] = sorted(tt_res, key=lambda x: x['num'])

    info = soup.find('div', {'class': 'alert alert-info'})
    ch_info = info.children
    ch_info.__next__()
    res["total_questions"] = int(ch_info.__next__().find('strong').text)
    ch_info.__next__()
    res["current_questions"] = int(ch_info.__next__().find('strong').text)
    ch_info.__next__()
    ch_info.__next__()
    ch_info.__next__()
    res["time_left"] = datetime.strptime(ch_info.__next__().find('strong').text, '%H:%M:%S')

    return res


def _start_test(sid: str) -> bool:
    _headers = {
        'Cookie': f'SID={sid}'
    }

    _url = 'http://in.3level.ru/?module=testing'
    _data = {
        'section_id': 1,
        'test_id': 19,
        'submit_button': 'Выбрать'
    }

    return requests.post(_url, headers=_headers, data=_data).status_code == 200


def _answer_question(sid: str, question_index: int, answer: int) -> dict:
    _headers = {
        'Cookie': f'SID={sid}'
    }

    _url = 'http://in.3level.ru/?module=testing'
    _data = {
        'current_question': question_index,
        'answer': answer,
        'submit_button': 'Ответить'
    }

    return _parse_page(requests.post(_url, headers=_headers, data=_data).text, is_html=True)
