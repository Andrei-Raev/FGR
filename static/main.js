const logContainer = document.querySelector('.scroll-inner');
const yesColor = 'var(--yes-color)';
const noColor = 'var(--no-color)';

const questionDiv = document.getElementById('question');

let previousTimeInSeconds = Infinity;

let resultGranted = false;

let copyTask = '';

let mult_answer = false;

// let test_id_g = 0;

function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=0; path=/; domain=' + window.location.hostname;
}

function logout() {
    deleteCookie('SID');
    window.location.href = '/login';
}

function getCookie(name) {
    let dc = document.cookie;
    let prefix = name + "=";
    let begin = dc.indexOf("; " + prefix);
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


    // delay ,5
    setTimeout(() => {
        document.getElementById('log-container').scrollTop = logContainer.scrollHeight;
    }, 500);
}

function showTestSelector(tests) {
    return new Promise((resolve) => {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.borderRadius = 'var(--border-radius)';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.padding = '20px';
        container.style.backgroundColor = '#fff';
        container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        container.style.zIndex = '1000';

        const title = document.createElement('h2');
        title.innerText = 'Выберите тест';
        container.appendChild(title);

        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.marginBottom = '10px';

        tests.forEach(test => {
            const option = document.createElement('option');
            option.value = test.key_id;
            option.innerText = test.description;
            select.appendChild(option);
        });

        container.appendChild(select);

        const button = document.createElement('button');
        button.innerText = 'Подтвердить';
        button.style.display = 'block';
        button.style.width = '100%';

        button.onclick = function () {
            const selectedValue = select.value;
            document.body.removeChild(container);
            resolve(selectedValue);
        };

        container.appendChild(button);
        document.body.appendChild(container);
    });
}


function get_status() {
    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));

    let request = new Request(`/status`, {
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
                const tests = [
                    {key_id: 'OPPR_2024', description: 'Итоговый тест "Оптимизация процессов и принятия решений"'},
                    {key_id: 'AAP_2024', description: 'Итоговый тест "Архитектурное проектирование"'},
                    {key_id: 'AAP_KURS', description: 'Тест по курсовому проекту "Архитектурное проектирование"'},
                    {
                        key_id: 'AAP_STYLE',
                        description: 'Тест на знание стилей "Автоматизация архитектурного проектирования"'
                    },
                ];

                showTestSelector(tests).then(selectedTestId => {
                    if (selectedTestId) {
                        logMessage("Вы начали тестирование");
                        startTest(selectedTestId);
                    } else {
                        logMessage("Вы отказались от тестирования.<br/>Перезагрузите страницу", noColor);
                    }
                });

            }
        })
}

function startTest(test_id) {
    // test_id_g = test_id;
    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));
    header.append('Content-Type', 'application/json; charset=UTF-8');

    let request = new Request('/start_test', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({test_id: test_id})
    });

    fetch(request)
        .then(res => res.json())
        .then(data => {
            if (data.status) {
                updateQuestions();
                resultGranted = false;
            } else {
                logMessage("Произошла ошибка: превышен лимит прохождения теста", noColor);
            }
        })


}

function reloadUI(data) {
    if (resultGranted) return;
    questionDiv.innerHTML = '';

    mult_answer = data.mult_answer;

    let questionSubDiv = document.createElement('div');
    questionSubDiv.classList.add('question-subdiv');
    questionDiv.appendChild(questionSubDiv);

    if (data.is_it_result_page) {
        logMessage('Тест завершен');
        displayResults(data);
        return;
    }

    if (data.auto) {
        logMessage("Ответ на вопрос " + data.question_number + " взят из базы", yesColor);
        updateQuestions();
    } else {
        let title = document.createElement('h3');
        title.innerHTML = 'Вопрос ' + data.question_number;
        title.classList.add('question-title');
        questionSubDiv.appendChild(title);

        if (mult_answer) {
            let tip = document.createElement('p');
            tip.innerHTML = 'Выберите несколько вариантов ответа';
            tip.classList.add('question-tip');
            questionSubDiv.appendChild(tip);
        }

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

            answerRadio.type = mult_answer ? 'checkbox' : 'radio';

            answerRadio.name = 'answer';
            answerRadio.value = answer.num;
            answerRadio.id = `answer-${answer.num}`; // Добавляем уникальный id

            answerLabel.htmlFor = answerRadio.id;
            answerLabel.innerHTML = answer.text;
            if (mult_answer) {
                answerLabel.classList.add('mult-answer');
            }

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

        // let remainingTime = document.getElementById('remaining-time');
        // console.log(data.time_left);
        startTimer(data.time_left);
        // remainingTime.innerHTML = data.time_left;

        let progressBar = document.querySelector('progress');
        progressBar.value = data.question_number / data.total_answers * 100;


    }
}

function updateQuestions() {
    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));

    let request = new Request(`/question`, {
        method: 'GET',
        headers: header
    });

    fetch(request)
        .then(res => res.json())
        .then(data => {
            if (data.is_it_result_page) {
                logMessage('Тест завершен');
                displayResults(data);
                return;
            }

            reloadUI(data);
            if (data.auto && !data.is_it_result_page) {
                setTimeout(updateQuestions, 3000);
            }

            copyTask = parseAnswer(data);
        })
}

function encodeAnswer(answers) {
    /**
     * Кодирует ответ в одно целое число.
     * @param {number|Array<number>} answers - Если это единственный индекс, возвращает его.
     * Если массив, возвращает отрицательное число.
     * @return {number} Целое число, представляющее закодированный ответ.
     */
    if (typeof answers === 'number') {
        return answers;
    }

    if (Array.isArray(answers)) {
        let encoded = 0;
        for (const answer of answers) {
            encoded |= 1 << answer; // Устанавливаем бит с позиции 'answer' в 1
        }
        return -encoded; // Используем отрицательное значение для маркировки нескольких ответов
    }

    throw new Error("Аргумент должен быть числом или массивом чисел.");
}


function answerQuestion() {
    let answer = document.querySelector('input[name="answer"]:checked');
    if (!answer) return;

    let answers = document.querySelectorAll('input[name="answer"]:checked');
    let mult_answer = answers.length > 1; // Определяем, если несколько вариантов выбрано

    let header = new Headers();
    header.append('Cookie', 'SID=' + getCookie('SID'));

    let body = new FormData();

    if (mult_answer) {
        let selectedAnswers = Array.from(answers).map(input => parseInt(input.value, 10));
        body.append('answer', encodeAnswer(selectedAnswers));
    } else {
        body.append('answer', answer.value);
    }

    let request = new Request('/question', {
        method: 'POST',
        headers: header,
        body: body
    });

    fetch(request)
        .then(res => res.json())
        .then(data => {
            if (data.is_last_success) {
                logMessage('Верный ответ', yesColor);
                oneMoreA();
            } else {
                logMessage('Неверный ответ', noColor);
            }


            if (data.is_it_result_page) {
                logMessage('Тест завершен');
                displayResults(data);
                return;
            }

            copyTask = parseAnswer(data);

            reloadUI(data);
        })
}


function startTimer(timeString) {
    const [minutes, seconds] = timeString.split(':').map(Number);
    const newTimeInSeconds = minutes * 60 + seconds;

    if (newTimeInSeconds < previousTimeInSeconds && timeString !== '20:00') {
        previousTimeInSeconds = newTimeInSeconds;
        updateTimer(newTimeInSeconds);
    }
}

function updateTimer(seconds) {
    const remainingTimeElement = document.getElementById('remaining-time');
    const intervalId = setInterval(() => {
        if (seconds <= 0) {
            clearInterval(intervalId);
            remainingTimeElement.innerHTML = "00:00";
            return;
        }
        seconds--;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        remainingTimeElement.innerHTML = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
}

function oneMoreA() {
    let count = document.getElementById('answer-count');
    count.innerHTML = parseInt(count.innerHTML) + 1;
}


// Функция для отображения данных
function displayResults(data) {
    resultGranted = true;
    // Очистка содержимого перед вставкой
    questionDiv.innerHTML = '';

    // Создание элементов
    const container = document.createElement('div');
    container.style.overflowY = 'auto'; // для скролирования
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.textAlign = 'center';

    const title = document.createElement('h2');
    title.innerText = 'Тест завершен';
    container.appendChild(title);

    const points = document.createElement('p');
    points.innerText = `Набрано баллов: ${data.statistics['Всего баллов']}`;
    container.appendChild(points);

    const correctPercentage = parseFloat(data.statistics['Процент правильных ответов']);
    const correctPercentText = document.createElement('p');
    correctPercentText.innerText = `Процент правильных ответов: ${correctPercentage}%`;
    container.appendChild(correctPercentText);

    const passText = document.createElement('p');
    passText.style.fontWeight = 'bold';
    passText.innerText = correctPercentage >= 80 ? 'Проходной балл достигнут' : 'Проходной балл НЕ достигнут';
    passText.style.color = correctPercentage >= 80 ? yesColor : noColor;
    if (correctPercentage >= 80) {
        logMessage('Проходной балл достигнут', yesColor);
    } else {
        logMessage('Проходной балл НЕ достигнут', noColor);
    }
    container.appendChild(passText);

    const ratingTitle = document.createElement('h3');
    ratingTitle.innerText = 'Рейтинг';
    container.appendChild(ratingTitle);

    const hr = document.createElement('hr');
    hr.style.margin = "5px 0 0 0";
    container.appendChild(hr);

    const ratingDiv = document.createElement('div');
    ratingDiv.style.overflowY = 'auto'; // для скролирования
    ratingDiv.style.maxHeight = '18rem';
    ratingDiv.style.marginBottom = '1rem';
    ratingDiv.style.scrollbarWidth = 'none';
    ratingDiv.style.scrollBehavior = 'smooth';

    const ratingTable = document.createElement('table');
    ratingTable.style.width = '100%';
    ratingTable.style.borderCollapse = 'collapse';
    ratingTable.style.margin = '10px 0';

    const tableHeaderRow = document.createElement('tr');
    const headers = ['Место', 'Информация', 'Процент правильных ответов'];
    headers.forEach(headerText => {
        const header = document.createElement('th');
        header.innerText = headerText;
        header.style.border = '1px solid #ddd';
        header.style.padding = '8px';
        tableHeaderRow.appendChild(header);
    });
    ratingTable.appendChild(tableHeaderRow);

    const currName = document.getElementById('user-name').innerText;
    data.ratings.forEach(entry => {
        const row = document.createElement('tr');
        Object.values(entry).forEach(value => {
            const cell = document.createElement('td');
            cell.innerText = value;
            cell.style.border = '1px solid #ddd';
            cell.style.padding = '8px';
            if (value === currName) {
                cell.style.color = yesColor;
            }

            row.appendChild(cell);
        });
        ratingTable.appendChild(row);
    });

    ratingDiv.appendChild(ratingTable);
    container.appendChild(ratingDiv);

    questionDiv.appendChild(container);
}


function parseAnswer(data) {
    let tip = mult_answer ? ' (Несколько вариантов ответа)' : '';
    let result = `Вопрос #${data.question_number}${tip}\n${data.question_text}\n\nВарианты:\n`;
    data.answers.forEach(answer => {
        result += `${answer.num + 1}. ${answer.text}\n`;
    });
    return result;
}

function copyText(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            logMessage('Скопировано')
        })
        .catch(error => {
            logMessage(`Текст не скопирован ${error}`)
        });
    console.log(text);
}

get_status();