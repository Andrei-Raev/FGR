const logContainer = document.getElementById('log-container');
const yesColor = 'var(--yes-color)';
const noColor = 'var(--no-color)';

const questionDiv = document.getElementById('question');

function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=0; path=/; domain=' + window.location.hostname;
}

function logout() {
    deleteCookie('SID');
    window.location.href = '/login';
}

function getCookie(name) {
    var dc = document.cookie;
    var prefix = name + "=";
    var begin = dc.indexOf("; " + prefix);
    if (begin === -1) {
        begin = dc.indexOf(prefix);
        if (begin !== 0) return null;
    } else {
        begin += 2;
        var end = document.cookie.indexOf(";", begin);
        if (end === -1) {
            end = dc.length;
        }
    }
    // because unescape has been deprecated, replaced with decodeURI
    //return unescape(dc.substring(begin + prefix.length, end));
    return decodeURI(dc.substring(begin + prefix.length, end));
}

function logMessage(message, color = 'var(--text-color)') {
    let newElement = document.createElement('div');
    newElement.classList.add('log-item');
    newElement.style.color = color;
    newElement.innerHTML = message;
    logContainer.appendChild(newElement);
}

function get_status() {
    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));

    let request = new Request('/status', {
        method: 'GET',
        headers: header
    });

    fetch(request)
        .then(res => res.json())
        .then(data => {
            if (data.in_base) {
                let answerCount = document.getElementById('answer-count');
                answerCount.innerHTML = data.in_base;
            }

            if (data.status) {
                updateQuestions();
                logMessage("Вы продолжаете тестирование");

            } else {
                let res = confirm("Начать тестирование?");
                if (res) {
                    logMessage("Да начнется тест!", yesColor);
                    startTest();
                } else {
                    logMessage("Вы отказались от тестирования.<br/>Перезагрузите страницу", noColor);
                }
            }
        })
}

function startTest() {
    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));

    let request = new Request('/start_test', {
        method: 'POST',
        headers: header
    });

    fetch(request)
        .then(res => res.json())
        .then(data => {
            if (data.status) {
                updateQuestions();
            } else {
                logMessage("Произошла ошибка...", noColor);
            }
        })


}

function reloadUI(data) {
    questionDiv.innerHTML = '';

    let questionSubDiv = document.createElement('div');
    questionSubDiv.classList.add('question-subdiv');
    questionDiv.appendChild(questionSubDiv);

    if (data.auto) {
        logMessage("Ответ на вопрос " + data.question_number + " взят из базы!", yesColor);
        updateQuestions();
    } else {
        let title = document.createElement('h3');
        title.innerHTML = 'Вопрос ' + data.question_number;
        title.classList.add('question-title');
        questionSubDiv.appendChild(title);

        if (data.question_text) {
            let question = document.createElement('p');
            question.innerHTML = data.question_text;
            questionSubDiv.appendChild(question);
        }

        for (let img of data.question_img) {
            let image = document.createElement('img');
            image.src = img;
            image.classList.add('question-img');
            questionSubDiv.appendChild(image);
        }

        let answerDiv = document.createElement('div');
        answerDiv.classList.add('question-answer-div');
        let wrap = document.createElement('div');
        wrap.classList.add('question-answer-div-wrap');
        wrap.appendChild(answerDiv);
        questionDiv.appendChild(wrap);

        let selectRadio = document.createElement('div');
        selectRadio.classList.add('question-select-radio');

        for (let answer of data.answers) {
            let answerRadio = document.createElement('input');
            let answerLabel = document.createElement('label');

            answerRadio.type = 'radio';
            answerRadio.name = 'answer';
            answerRadio.value = answer.num;
            answerRadio.id = `answer-${answer.num}`; // Добавляем уникальный id

            answerLabel.htmlFor = answerRadio.id;
            answerLabel.innerHTML = answer.text;

            let sp = document.createElement('span');
            sp.classList.add('answer-span');
            sp.appendChild(answerRadio);
            sp.appendChild(answerLabel);

            selectRadio.appendChild(sp);
        }

        answerDiv.appendChild(selectRadio);


        let button = document.createElement('button');
        button.innerHTML = 'Ответить';
        button.classList.add('question-button');
        button.onclick = answerQuestion;

        answerDiv.appendChild(button);


        let answeredCorrect = document.getElementById('answered-correct');
        answeredCorrect.innerHTML = data.correct_answers;

        let totalQuestions = document.getElementById('total-questions');
        totalQuestions.innerHTML = data.total_answers;

        let remainingTime = document.getElementById('remaining-time');
        remainingTime.innerHTML = data.time_left;

        let progressBar = document.querySelector('progress');
        progressBar.value = data.question_number / data.total_answers * 100;


    }
}

function updateQuestions() {
    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));

    let request = new Request('/question', {
        method: 'GET',
        headers: header
    });

    fetch(request)
        .then(res => res.json())
        .then(data => {
            reloadUI(data);
            if (data.auto) {
                setTimeout(updateQuestions, 1000);
            }
        })
}

function answerQuestion() {
    let answer = document.querySelector('input[name="answer"]:checked');
    if (!answer) return;

    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));

    let body = new FormData();
    body.append('answer', answer.value);

    let request = new Request('/question', {
        method: 'POST',
        headers: header,
        body: body
    });

    fetch(request)
        .then(res => res.json())
        .then(data => {
            reloadUI(data);

            if (data.is_last_success) {
                logMessage('Верный ответ!', yesColor);
            } else {
                logMessage('Неверный ответ!', noColor);
            }
        })
}

get_status();