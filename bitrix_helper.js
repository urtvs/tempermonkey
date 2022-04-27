// ==UserScript== Обновлено 14 февраля 2022 - Обзвон галерея(Добавлена функция showImage)

/* global $ */
const version = '3';
const CORE_DEBUG_MODE = false;

const bitrix_helper = function ()
{
    const API_URL = 'https://a.unirenter.ru/b24/api/notifyBitrix.php?version=' + version + '&userID=' + userID + '&ah=' + userToken;

    /*
    * --------------------------- Functions
    */

    // delegate
    function on(elSelector, eventName, selector, fn)
    {
        var element = document.querySelector(elSelector);

        element.addEventListener(eventName, function (event)
        {
            var possibleTargets = element.querySelectorAll(selector);
            var target = event.target;

            for (var i = 0, l = possibleTargets.length; i < l; i++)
            {
                var el = target;
                var p = possibleTargets[i];

                while (el && el !== element)
                {
                    if (el === p)
                    {
                        return fn.call(p, event);
                    }

                    el = el.parentNode;
                }
            }
        });
    }

    async function appendStyle(cssRules, link = false)
    {
        var style_element = document.createElement('style');
        style_element.appendChild(document.createTextNode(link ? await fetch(cssRules).then(response => response.text()) : cssRules));
        document.head.appendChild(style_element);
    }

    function waitForElement(selector, target)
    {
        DEBUG_MODE && console.log('Ожидание элемента' + selector + ' ...');
        return new Promise(function (resolve)
        {
            var element = (target || document).querySelector(selector);

            if (element)
            {
                DEBUG_MODE && console.log('Найден ' + selector, element);
                resolve(element);
                return;
            }

            var observer = new MutationObserver(function (mutations)
            {
                mutations.forEach(function (mutation)
                {
                    var nodes = Array.from(mutation.addedNodes);
                    for (var node of nodes)
                    {
                        if (node.matches && node.matches(selector))
                        {
                            observer.disconnect();
                            resolve(node);
                            return;
                        }
                    }
                });
            });

            observer.observe(target || document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }

    /**
     * Функция слежения за изменениями в DOM (внутри target)
     * @param {string} selector Селектор наблюдаемого элемента
     * @param {Node} target Родительский элемент
     * @param {string} callback Функция обратного вызова
     * @param {boolean} disposable Отключение слежки после первого изменения
     */
    function watchDomMutation(selector, target, callback, disposable = false)
    {
        DEBUG_MODE && console.log('Ожидание мутации в ' + selector + ' ...');
        const observer = new MutationObserver((mutationsList) =>
        {
            for (let mutation of mutationsList)
            {
                if (mutation.type !== 'childList' || !mutation.addedNodes.length)
                {
                    continue;
                }
                Array.from(mutation.addedNodes).forEach(function (node)
                {
                    if (!(node instanceof Element))
                    {
                        return;
                    }
                    CORE_DEBUG_MODE && console.log('CORE_DEBUG_MODE', 'Mutation of', node, 'in', target);
                    if (node.matches(selector))
                    {
                        DEBUG_MODE && console.log('Мутация в ' + selector);
                        callback(node);
                        disposable && observer.disconnect();
                        return observer;
                    }
                });
            }
        });
        observer.observe(target, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Синхронная функция задержки(паузы)
     * @param {int} ms
     * @returns Promise<null>
     */
    function delay(ms)
    {
        return new Promise(r => setTimeout(() => r(), ms))
    }

    async function getApiData(params)
    {
        const params_str = Object.keys(params).map(key => '&' + key + '=' + params[key]).join('');
        DEBUG_MODE && console.log('АПИ запрос на ' + API_URL + params_str);
        try
        {
            const response = await fetch(API_URL + params_str);
            DEBUG_MODE && console.log('API response:', response);
            const contentType = response.headers.get("content-type");
            return (contentType && contentType.indexOf("application/json") !== -1)
                ? await response.json()
                : response.text();
        }
        catch (e)
        {
            DEBUG_MODE && console.error('API error:', e);
            return null;
        }
    }

    function getPhoneNumber()
    {
        // Setup phone code priorities
        var priority = ['79', '74'];
        var phoneNumbersContainers = document.querySelectorAll('.crm-entity-phone-number');

        if (!phoneNumbersContainers.length)
        {
            phoneNumbersContainers
                = document.querySelectorAll('.crm-entity-widget-client-contact-phone');
        }

        if (phoneNumbersContainers.length)
        {
            var phoneNumbersHTML = Array.prototype.map.call(phoneNumbersContainers, function (n)
            {
                return n.innerHTML;
            });
            for (var i = 0; priority.length > i; i++)
            {
                for (var n = 0; phoneNumbersHTML.length > n; n++)
                {
                    if (phoneNumbersHTML[n].replace(/[^\d]/g, '').startsWith(priority[i]))
                    {
                        return phoneNumbersHTML[n];
                    }
                }
            }
            return phoneNumbersHTML.pop();
        }
        else
        {
            return null;
        }
    }

    /**
     * OwlCarousel2 https://github.com/OwlCarousel2/OwlCarousel2
     * Magnific-Popup https://github.com/dimsemenov/Magnific-Popup/
     */
    function useGalleryCarousel()
    {
        appendStyle('https://raw.githubusercontent.com/OwlCarousel2/OwlCarousel2/develop/dist/assets/owl.carousel.min.css', true);
        appendStyle('https://raw.githubusercontent.com/dimsemenov/Magnific-Popup/master/dist/magnific-popup.css', true);
    }

    /**
     * OwlCarousel2 https://github.com/OwlCarousel2/OwlCarousel2
     * Magnific-Popup https://github.com/dimsemenov/Magnific-Popup/
     * @param data Object
     * @param options Object OwlCarousel options
     * @returns {Promise<Node>}
     */
    function makeGalleryCarousel(data, options, container)
    {
        return new Promise(resolve =>
        {
            const carousel_container = document.createElement('div');
            carousel_container.innerHTML = `<h2 class="slide__title"><a href="${data.info.advUrl}" target="_blank">${data.info.advName}</a></h2>`;
            const slider = document.createElement('div');
            slider.className = 'owl-carousel owl-theme';
            data.image.forEach(image_url =>
            {
                let slide = document.createElement('img');
                slide.className = 'slide';
                slide.src = image_url;
                slider.appendChild(slide);
                let moved = false;
                $(slide)
                    /* Конфликт событий клик и драг https://stackoverflow.com/questions/6042202/how-to-distinguish-mouse-click-and-drag */
                    .mousedown(function ()
                    {
                        moved = false;
                    })
                    .mousemove(function ()
                    {
                        moved = true;
                    })
                    .mouseup(function (event)
                    {
                        if (!moved) // clicked without moving mouse
                        {
                            $.magnificPopup.open({
                                items: {
                                    src: image_url
                                },
                                type: 'image',
                                zoom: {
                                    enabled: true,
                                    duration: 300,
                                    easing: 'ease-out',
                                    opener: function ()
                                    {
                                        return $(slide);
                                    }
                                }
                            }, 0);
                        }
                    });
            });
            carousel_container.appendChild(slider);
            container.appendChild(carousel_container);
            $(slider).owlCarousel(options);

            resolve(carousel_container);
        });
    }


    /*
    * ----------------------------- Setup document type, ID.
    */

    var docType, docId;

    if (location.href.includes('lead/details'))
    {
        docType = 'lead';
        docId = /\/lead\/details\/(\d+)\//.exec(location.href)[1];
    }
    else if (location.href.includes('deal/details'))
    {
        docType = 'deal';
        docId = /\/deal\/details\/(\d+)\//.exec(location.href)[1];
    }
    else if (location.href.includes('deal/list'))
    {
        docType = 'deal-list';
    }
    else if (location.href.includes('deal/category'))
    {
        docType = 'deal-category';
    }
    else if (location.href.includes('contact/details'))
    {
        docType = 'contact';
        docId = /\/contact\/details\/(\d+)\//.exec(location.href)[1];
    }

    console.log(docType, docId);

    /*
    * ----------------------------- Search
    */

    // #4 - search deal
    function createHeaderSearch(argument)
    {
        var header = document.querySelector('.header-search');

        // Найдем стандартный элемент с формой ввода
        // и установим его ширину в 40% и сделаем строчным,
        // чтобы влез наш элемент
        let standartInput = document
            .querySelector('.header-search.timeman-simple.header-search-empty');

        standartInput.style.maxWidth = '40%';
        standartInput.style.display = 'inline-block';

        if (header)
        {
            var searchContainer = document.createElement('div');
            searchContainer.className = 'header-search timeman-simple header-search-empty';
            searchContainer.innerHTML = '<div class="header-search-inner">\
            <form class="header-search-form" method="get" onsubmit="window.open(\'https://unirenter.bitrix24.ru/crm/deal/details/\'+this.elements[0].value.replace(/[^0-9]/g, \'\')+\'/\'); this.reset(); return false;" action="">\
              <input class="header-search-input" type="text" autocomplete="off" placeholder="искать сделку" onclick="BX.addClass(this.parentNode.parentNode.parentNode,\'header-search-active\')" onblur="BX.removeClass(this.parentNode.parentNode.parentNode, \'header-search-active\')">\
              <span class="header-search-icon header-search-icon-title"></span>\
              <span class="search-title-top-delete"></span>\
            </form>\
          </div>';

            // Наш элемент тоже делаем меньше и строчным
            searchContainer.style.maxWidth = '40%';
            searchContainer.style.display = 'inline-block';
            header.appendChild(searchContainer);
        }
    }


    // #4 - deal title bold
    var dealTitle = document.getElementById('pagetitle');
    if (dealTitle && docType === 'deal')
    {
        var newTitle = document.createElement('b');
        if (window.location.href.indexOf('IFRAME') == -1)
        {
            newTitle.innerHTML += '<br>';
        }
        newTitle.innerHTML += docId;
        dealTitle.parentNode.appendChild(newTitle);
    }

    // #3 - product name
    document.body.addEventListener('DOMSubtreeModified', function ()
    {
        addProductButtons();
    }, false);

    var headerInterval = setInterval(function ()
    {
        var headerSearch = document.querySelector('.header-search');
        if (headerSearch)
        {
            createHeaderSearch();
            clearInterval(headerInterval);
        }
    }, 500);

    var toolbarInterval = setInterval(function ()
    {
        var toolbarSearch = document.querySelector('.crm-entity-actions-container');
        if (toolbarSearch)
        {
            addToolbarButtons();
            clearInterval(toolbarInterval);
        }
    }, 500);

    function addProductButtons()
    {
        var inputs = document.querySelectorAll('input.crm-item-name-inp');
        inputs.forEach(function (el)
        {
            try
            {
                var parsedSk = /sk(-|_)(\d+)-(\d+)/.exec(el.value);
                if (!parsedSk)
                {
                    var parsed = /(\d{6})(-|=)(\d{6})/.exec(el.value);
                }
                if (parsed || parsedSk)
                {//&& parsed[1] && parsed[3]) {
                    if (!el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons'))
                    {
                        var container = document.createElement('div');
                        container.innerHTML = '<span data-mode="comment" data-field="' + el.id + '" title="Добавить комментарий к товару" class="bitrixHelper-productButton crm-item-move-btn" style="background: url(//a.unirenter.ru/b24/img/add-comment.png); ' + ((parsed && parsed[1] && parsed[3]) ? 'display:inline-block;' : 'display:none;') + '"></span>';
                        container.innerHTML += '<span data-mode="info" data-field="' + el.id + '" title="Информация о товаре" class="bitrixHelper-productButton crm-item-move-btn" style="background: url(//a.unirenter.ru/b24/img/document.png);"></span>';
                        container.className = 'bitrixHelper-productButtons';
                        el.parentNode.parentNode.parentNode.querySelector('.crm-table-name-left').appendChild(container);
                    }
                }

                if (el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons'))
                {
                    //el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons').remove();
                    if (parsedSk && parsedSk[2] && parsedSk[3])
                    {
                        el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons span[data-mode="info"]').style.display = 'inline-block';
                        el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons span[data-mode="comment"]').style.display = 'none';
                    }
                    else if (parsed && parsed[1] && parsed[3])
                    {
                        el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons span[data-mode="info"]').style.display = 'inline-block';
                        el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons span[data-mode="comment"]').style.display = 'inline-block';
                    }
                    else
                    {
                        el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons span[data-mode="info"]').style.display = 'none';
                        el.parentNode.parentNode.parentNode.querySelector('.bitrixHelper-productButtons span[data-mode="comment"]').style.display = 'none';
                    }
                }
            }
            catch (ex)
            {
            }
        });
    }

    addProductButtons();

    on("body", "input", ".crm-item-name-inp", () =>
    {
        addProductButtons();
    });

    on("body", "click", ".bitrixHelper-productButton", (target, evt) =>
    {
        var mode = target.target.getAttribute('data-mode');
        var field = document.querySelector('#' + target.target.getAttribute('data-field'));
        var parsedSk = /sk(-|_)(\d+)-(\d+)/.exec(field.value);
        var parsed = /(\d{6})(-|=)(\d{6})/.exec(field.value);
        if (parsedSk && parsedSk[2] && parsedSk[3])
        {
            if (mode === 'info')
            {
                window.open('https://a.unirenter.ru/b24/r.php?article=sk_' + parsedSk[2] + '-' + parsedSk[3]);
            }
        }
        else if (parsed && parsed[1] && parsed[3])
        {
            if (mode === 'comment')
            {
                window.open('https://beta.crm.unirenter.ru/#/add-comment?dealID=' + docId + '&article=' + parsed[1] + '&serial=' + parsed[3]);
            }
            else if (mode === 'info')
            {
                window.open('https://beta.crm.unirenter.ru/#/info?article=' + parsed[1] + '&serial=' + parsed[3]);
            }
        }
    });

    if (['deal', 'lead', 'contact'].includes(docType))
    {

        /*
        * ----------------------------- Alerts
        */

        appendStyle('#growls-br{z-index:16000;position:fixed;bottom:10px;right:56px}.growl{opacity:.8;position:relative;border-radius:4px;-webkit-transition:all .4s ease-in-out;-moz-transition:all .4s ease-in-out;transition:all .4s ease-in-out}.growl:hover{opacity:1;}.growl.growl-incoming{opacity:0}.growl.growl-outgoing{opacity:0}.growl.growl-large{width:300px;padding:15px;margin:15px}.growl.growl-default{color:#fff;background:#535C69;box-shadow: 0 0 3px 1px rgba(255,255,255,.2);}.growl .growl-close{cursor:pointer;float:right;font-size:18px;line-height:18px;font-weight:400;font-family:helvetica,verdana,sans-serif}.growl .growl-title{font-size:12px;line-height:24px;font-weight:bold}.growl .growl-message{font-size:14px;line-height:18px}.close-all-alerts{display:none;margin-left:auto;margin-right:23px;padding: 5px 9px;color:#fff;border:none;background-color:#535C69;border-radius:4px;cursor:pointer;opacity:.8;transition:opacity .5s}.close-all-alerts:hover{opacity:1}');

        var closeAllBtn = null;
        window.growls = {};

        function getAlerts(url, callback)
        {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function ()
            {
                if (this.readyState === 4 && this.status === 200)
                {
                    try
                    {
                        var responseJSON = JSON.parse(this.responseText);
                    }
                    catch (error)
                    {
                        console.log(error);
                        return;
                    }
                    callback(responseJSON.msg);
                }
            };
            xhttp.open('GET', url, true);
            xhttp.send();
        }

        function appendAlerts(alerts = {}, alertsType)
        {

            if (typeof window.growls[alertsType] === 'undefined')
            {
                window.growls[alertsType] = {};
            }

            for (var index in alerts)
            {
                if (alertsType === 'comment' && typeof window.growls['comment'][index] !== 'undefined')
                {
                    continue;
                }
                if (typeof window.growls[alertsType][index] !== 'undefined')
                {
                    window.growls[alertsType][index].remove();
                }
                window.growls[alertsType][index] = $.growl({
                    title: alerts[index].title,
                    message: alerts[index].msg,
                    location: 'br',
                    size: 'large',
                    fixed: true,
                    delayOnHover: false
                });
                window.growls[alertsType][index]['$_growl'][0].style.backgroundColor = alerts[index].bColor;
                window.growls[alertsType][index]['$_growl'][0].style.color = alerts[index].tColor;
                window.growls[alertsType][index]['$_growl'][0].dataset.notifyId = index;
            }
            if (countAlerts() > 1 && !closeAllBtn)
            {
                var growls = document.getElementById('growls-br');
                closeAllBtn = document.createElement("button");
                closeAllBtn.setAttribute('title', 'Закрыть все');
                closeAllBtn.addEventListener("click", function ()
                {
                    for (var alertsType in window.growls)
                    {
                        removeAlerts(alertsType);
                    }
                }, false);
                closeAllBtn.innerHTML = 'X';
                closeAllBtn.classList.add('close-all-alerts');
                closeAllBtn.style.display = 'block';
                growls.prepend(closeAllBtn);
            }
            if (document.getElementById('growls-br'))
            {
                var observeComments = new MutationObserver(function ()
                {
                    if (closeAllBtn)
                    {
                        closeAllBtn.style.display = document.querySelectorAll('#growls-br .growl').length > 1 ? 'block' : 'none';
                    }
                });
                observeComments.observe(document.getElementById('growls-br'), {
                    childList: true,
                    subtree: true
                })
            }
        }

        function countAlerts()
        {
            if (typeof window.growls !== 'object' || window.growls === null)
            {
                return 0;
            }
            var count = 0;
            for (var aType in window.growls)
            {

                count += Object.keys(window.growls[aType]).length
            }
            return count;
        }

        function removeAlerts(alertsType)
        {
            for (var index in window.growls[alertsType])
            {
                window.growls[alertsType][index].remove();
            }
        }

        function removeAlert(alertsType, alertId)
        {
            if (window.growls[alertsType].hasOwnProperty(alertId))
            {
                window.growls[alertsType][alertId].remove();
            }
        }

        /*
        * ----------------------------- Toolbar
        */

        appendStyle('.pagetitle-inner-container.two-lines  { flex-wrap:wrap; padding-bottom:11px }' +
            '.two-lines .pagetitle-menu:before { height:auto }' +
            '.pagetitle-menu { padding-left:0; padding-right:0 }' +
            '.pagetitle-menu.pagetitle-last-item-in-a-row { order:3; display:none }' +
            '.pagetitle-inner-container > div.added-buttons { order:4; white-space:nowrap; margin-right:13px }' +
            '.pagetitle-inner-container.two-lines > div:not(.pagetitle) { margin-left:auto; padding:3px 0 }')

        appendStyle('.bitrixHelper-toolbarButton:after, .bitrixHelper-productButton { background-size:27px !important; }' +
            '.header-search .header-search.timeman-simple { display:inline-block; max-width:40% !important; }' +
            '.bitrixHelper-productButtons { display:inline-block !important; }' +
            '.bitrixHelper-productButton { cursor:pointer; width:27px !important; height:27px !important; opacity:0.8; margin: 0 3px 0 0 !important; }');


        function addToolbarButton(obj)
        {
            var toolbar = document.querySelector('.pagetitle-inner-container > div.added-buttons');

            if (!toolbar)
            {
                var t = document.querySelector('.pagetitle-inner-container');
                if (!t)
                {
                    return;
                }
                toolbar = document.createElement('div');
                toolbar.classList.add('added-buttons');
                t.prepend(toolbar);
            }

            var button = document.createElement('button');
            if (obj.onclick)
            {
                button.setAttribute('onclick', obj.onclick);
            }
            if (obj.title)
            {
                button.setAttribute('title', obj.title);
            }
            if (obj.style)
            {
                button.setAttribute('style', obj.style);
            }
            button.setAttribute('class', 'bitrixHelper-toolbarButton ui-btn ui-btn-light-border ui-btn-themes ui-btn-icon-setting ui-btn-themes ' + (obj.class || ''));

            toolbar.appendChild(button);
            return button;
        }

        function copyPhoneToClipboard()
        {
            var phone = getPhoneNumber();
            if (phone)
            {
                navigator.clipboard.writeText(phone).then(function ()
                {
                }, function (err)
                {
                    console.error('Не получилось записать текс в буфер обмена: ', err);
                });
            }
            else
            {
                console.error('Номер телефона ' + phone + ' не найден.');
                alert('Номер телефона не найден.');
            }
        }

        function getInnerWidth(element)
        {
            var w = 0;
            element.children().each(function ()
            {
                w += $(this).width();
            });
            return w;
        }

        // Добвляем кнопки в тулбар
        function addToolbarButtons()
        {

            var pagetitleContainer = $('.pagetitle-inner-container');
            var titleWidth = getInnerWidth($('.pagetitle.crm-pagetitle'));

            function setPagetitleSize()
            {
                pagetitleContainer[pagetitleContainer.width() - titleWidth - 750 < 0 ? 'addClass' : 'removeClass']('two-lines');
            }

            $(window).resize(function ()
            {
                var resizeTimeout = setTimeout(
                    function ()
                    {
                        clearTimeout(resizeTimeout);
                        setPagetitleSize();
                    }, 200
                )
            });
            setPagetitleSize();

            switch (docType)
            {
                case 'deal':
                    addToolbarButton({
                        'onclick': 'window.open(\'https://a.unirenter.ru/b24/r.php?form=payment&do=paymentSys&dealID=' + docId + '\');',
                        'title': 'Напечатать чек',
                        'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/invoice-add.png);'
                    });
                    addToolbarButton({
                        'onclick': 'window.open(\'https://a.unirenter.ru/b24/r.php?ph=' + docId + '&deal=' + docId + '\');',
                        'title': 'Информация по сделке',
                        'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/document.png);'
                    });
                    addToolbarButton({
                        'onclick': 'window.open(\'https://beta.crm.unirenter.ru/#/add-comment?dealID=' + docId + '\');',
                        'title': 'Добавить комментарий',
                        'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/add-comment.png);'
                    });
                    break;
                case 'lead':
                    addToolbarButton({
                        'onclick': 'window.open(\'https://a.unirenter.ru/b24/r.php?article=&ph=' + getPhoneNumber() + '\');',
                        'title': 'Информация по лиду',
                        'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/document.png);'
                    });
                    break;
                case 'contact':
                    addToolbarButton({
                        'onclick': 'window.open(\'https://a.unirenter.ru/b24/r.php?article=&ph=k' + docId + '\');',
                        'title': 'Информация по контакту',
                        'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/document.png);'
                    });
                    break;
            }
            $('div.ui-btn-split.ui-btn-light-border.ui-btn-themes.intranet-binding-menu-btn').remove();

            //$('.pagetitle-wrap').append('<div class="pagetitle crm-pagetitle">'+$('.pagetitle.crm-pagetitle').html()+'</div>');
            //$('#pagetitle').remove();

            var copyPhoneNumberButton = addToolbarButton({
                'title': 'Скопировать номер телефона',
                'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/icons8-phone-64.png);'
            });

            copyPhoneNumberButton.addEventListener('click', function ()
            {
                copyPhoneToClipboard();
            });

            var showRecordTimeButton = addToolbarButton({
                'title': 'Время записи',
                'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/icons8-timetable-48.png);'
            });

            showRecordTimeButton.addEventListener('click', function ()
            {
                showRecordTime();
            });

            var reloadCommentsButton = addToolbarButton({
                'title': 'Обновить комментарии',
                'style': '--ui-btn-icon: url(//a.unirenter.ru/b24/img/alert.png);'
            });

            reloadCommentsButton.addEventListener('click', function ()
            {
                showComments();
            });
        }

        function showRecordTime()
        {
            showComments('&do=timetable');
        }

        var showCommentsInterval;

        function showComments(params = '')
        {
            var url = API_URL + '&doc=' + docType + '&id=' + docId + (docType === 'lead' ? '&phone=' + getPhoneNumber() : '') + params;
            reloadAlerts(url, 'comment');
            clearInterval(showCommentsInterval);
            showCommentsInterval = setInterval(function ()
            {
                showAlerts(url, 'comment');
            }, 5000);
        }

        function showAlerts(url, alertsType)
        {
            getAlerts(url,
                function (alerts)
                {
                    appendAlerts(alerts, alertsType);
                    alertsTicking[alertsType] = false;
                }
            );
        }

        var alertsTicking = [];

        function reloadAlerts(url, alertsType)
        {
            if (!alertsTicking[alertsType])
            {
                alertsTicking[alertsType] = true;
                removeAlerts(alertsType);
                window.growls[alertsType] = {};
                showAlerts(url, alertsType);
            }
        }

        showComments();

        /*
        * ----------------------------- Comment
        */

        var searchParams = new URLSearchParams(location.search);

        if (searchParams.has('comment'))
        {

            var commentText = searchParams.get('comment');

            // Adding comment to page Comment Area
            waitForElement('.bx-editor-iframe').then(function (iframe)
            {

                var editorWindow = iframe.contentWindow,
                    editorDocument = editorWindow.contentDocument || editorWindow.document,
                    writeComment = function ()
                    {
                        editorDocument = editorWindow.contentDocument || editorWindow.document;
                        setTimeout(function ()
                        {
                            editorDocument.body.innerHTML = commentText;
                        }, 50);
                    };

                if (editorDocument.readyState === 'complete')
                {
                    writeComment();
                }
                else
                {
                    editorWindow.addEventListener('load', writeComment);
                }
            });

            // Adding comment to call Comment Area
            waitForElement('.im-phone-call-crm-button-comment').then(function ()
            {
                var textarea = document.querySelector('.im-phone-call-comments-textarea'),
                    button = document.querySelector('.im-phone-call-crm-button-comment');
                button.click();
                textarea.value = commentText;
                textarea.dispatchEvent(new Event('change'));
                button.click();
            });
        }

        /*
        * ShowDocumentComments, showPopup
        * */

        window.showDocumentComments = function (param, eventTarget)
        {
            var notifyId = eventTarget.closest('div.growl[data-notify-id]').dataset.notifyId;
            var confirmUrl = API_URL + '&doc=' + docType + '&id=' + docId + (docType === 'lead' ? '&phone=' + getPhoneNumber() : '');
            if (param)
            {
                confirmUrl += param;
            }

            DEBUG_MODE && console.log('Do query to confirmUrl', confirmUrl);

            fetch(confirmUrl).then(() =>
            {
                removeAlert('comment', notifyId);
                var url = API_URL + '&doc=' + docType + '&id=' + docId + (docType === 'lead' ? '&phone=' + getPhoneNumber() : '');
                showAlerts(url, 'comment');
            });
        }

        /*
        * ----------------------------- Popup
        */
        appendStyle('#popup_window {width:80vw;height:80vh;position:relative;position:absolute;top:10vh;left:10vw;z-index:100000;}' +
            '#popup_window > * {padding:12px 8px}' +
            '#popup_window header {background-color:rgba(99,99,99,.2)}' +
            '#popup_window header h4 {font-weight:bold;font-size:20px;margin:0;padding:0}' +
            '#popup_window header span#btn1221 {padding:5px 10px;float:right;border-radius:4px;background-color:#882c2c;font-size:15px;margin:-1px 5px 0;cursor:pointer;color:#fff}');

        window.popupIsLoading = false;
        window.showPopup = async function (url)
        {
            url += '&version=' + version + '&userID=' + userID + '&ah=' + userToken + '&doc=' + docType
                + '&id=' + docId + (docType === 'lead' ? '&phone=' + getPhoneNumber() : '');
            if (popupIsLoading)
            {
                return false;
            }
            popupIsLoading = true;
            let alreadyPopup = document.getElementById('popup_window');
            if (alreadyPopup)
            {
                closePopup(alreadyPopup);
            }
            DEBUG_MODE && console.log('Query URL: ', url);
            let data = await fetch(url).then(response => response.json());
            DEBUG_MODE && console.log('Data: ', data);
            if (data && data.hasOwnProperty('msg'))
            {
                const chatMessagesWrapper = $('body');
                let k = Object.keys(data.msg)[0];
                let message = data.msg[k];
                const popup = $('<div id="popup_window" style="background-color:' + message.bColor + '">' +
                    '<header>' +
                    '<span id="btn1221" onclick="closePopup(this)">Закрыть</span>' +
                    '<h4 style="color:' + message.tColor + '">' + message.title + '</h4>' +
                    '</header>' +
                    '<div style="color:' + message.tColor + '">' + message.msg + '</div>' +
                    '</div>');
                chatMessagesWrapper.append(popup);
                popupIsLoading = false;

            }
        }

        window.closePopup = function (element)
        {
            (element.id === 'popup_window' ? element : element.closest('div#popup_window')).remove();
        }

        useGalleryCarousel();
        appendStyle('.im-phone-call-list-container .owl-carousel .slide{cursor:pointer;}' +
            '.carousel_outer_container{position:fixed;bottom:10px;z-index:20000;width:50%;left:10%;background:#fff;padding:0 10px;border-radius:5px;box-shadow:0px 0px 10px rgb(184 184 255);}' +
            '.owl-carousel .owl-nav button{position:absolute;top:18%;font-size:60px !important;}' +
            '.owl-carousel .owl-nav button.owl-next{right:0}' +
            '.mfp-bg,.mfp-wrap{z-index:1000000 !important}' +
            '.owl-carousel .owl-stage {display:flex;align-items:center;}' +
            '.carousel_outer_container h2.slide__title{text-decoration:underline}' +
            '.carousel_outer_container > button{position:absolute;right:10px;top:10px;z-index:10}');
        window.showImage = async function (deal_id/*'84572'*/, event_target)
        {
            DEBUG_MODE && console.log('showImage:', deal_id, event_target);

            if (typeof showImage.carousel_outer_container == 'undefined')
            {
                window.showImage.carousel_outer_container = document.createElement('div');
                window.showImage.carousel_outer_container.className = 'carousel_outer_container';
                const close_button = document.createElement('button');
                close_button.innerHTML = 'X';
                close_button.addEventListener('click', function (event)
                {
                    window.showImage.carousel_outer_container.remove();
                    window.showImage.carousel_outer_container = undefined;
                })
                window.showImage.carousel_outer_container.appendChild(close_button);
                document.body.appendChild(window.showImage.carousel_outer_container);
            } else {
                window.showImage.carousel_outer_container.children[1].remove();
            }
            const api_data = await getApiData({'do': 'advImage', 'dealID': deal_id});
            DEBUG_MODE && console.log('api_data:', api_data);
            let adv_body = Object.values(api_data.results.advImage.result)[0];
            await makeGalleryCarousel(adv_body, {
                    'items': 6,
                    'nav': true,
                    'slideBy': 6,
                    'dots': true,
                    'margin': 8,
                },
                window.showImage.carousel_outer_container);
        }

        /*
        * ----------------------------- Audio player
        */

        appendStyle('.crm-audio-cap-wrap-container{width:auto;}.vjs-control.pbrateButton{font-weight:bold;font-size:8px;line-height:11px;position:absolute;top:6px;box-sizing:border-box;padding-right:1px;width:20px;height:20px;border:1px solid #abcbf3;border-radius:50%;color:#468ee5;transition: 220ms border ease;cursor:pointer}.vjs-control.pbrateButton:hover,.vjs-control.pbrateButton.active{border-color:#468ee5}.crm-audio-cap-wrap-container~button{margin-left:0 !important;width:32px !important;height:32px !important;}.crm-audio-cap-wrap-container~button:after{width:20px !important;height:20px !important;background-size:contain}');

        function setAudioPlaybackRateButtonTitle(button, rate)
        {
            button.setAttribute('title', 'Ускорить в ' + rate + ' раза');
        }

        function addAudioPlaybackRateButtons(videoJsPlayer)
        {
            var rates = [1.5, 2].reverse(),
                audio = videoJsPlayer.querySelector('audio'),
                placeAfter = videoJsPlayer.querySelector('.vjs-control-bar .vjs-progress-control'),
                rightOffset = parseInt(getComputedStyle(placeAfter).right),
                i = 0;

            while (i < rates.length)
            {
                var button = document.createElement("button");
                button.innerHTML = rates[i];
                button.dataset.rate = rates[i];
                setAudioPlaybackRateButtonTitle(button, rates[i]);
                button.classList.add('vjs-control', 'vjs-button', 'pbrateButton');
                button.style.right = rightOffset + i * 24 + 'px';
                button.addEventListener('click', function ()
                {
                    if (audio.playbackRate == this.dataset.rate)
                    {
                        this.classList.remove('active');
                        setAudioPlaybackRateButtonTitle(this, this.dataset.rate);
                        audio.playbackRate = 1;
                    }
                    else
                    {
                        var buttons = videoJsPlayer.querySelectorAll('.pbrateButton');
                        for (var i = 0; i < buttons.length; i++)
                        {
                            buttons[i].classList.remove('active');
                            setAudioPlaybackRateButtonTitle(buttons[i], buttons[i].dataset.rate);
                        }
                        this.classList.add('active');
                        this.setAttribute('title', 'Отключить ускорение');
                        audio.playbackRate = this.dataset.rate;
                    }
                });
                placeAfter.parentNode.insertBefore(button, placeAfter.nextSibling);

                i++;
            }

            // Set default playbackRate as maximum value
            videoJsPlayer.querySelector('.pbrateButton:last-of-type').click();

            var qualityControlButton = document.createElement('button');
            qualityControlButton.setAttribute('title', 'Контроль качества');
            qualityControlButton.setAttribute('style', '--ui-btn-icon: url(//a.unirenter.ru/b24/img/icons8-check-all-26.png);');
            qualityControlButton.setAttribute('class', 'ui-btn ui-btn-light ui-btn-themes ui-btn-icon-setting crm-entity-actions-button-margin-left ui-btn-themes');
            var audio_url = new URL('https://unirenter.bitrix24.ru' + audio.getAttribute('src'));
            var ownerId = audio_url.searchParams.get('ownerId');
            var fileId = audio_url.searchParams.get('fileId');
            qualityControlButton.setAttribute('onclick',
                'window.open(\'https://a.unirenter.ru/b24/r.php?form=form&do=call&ownerId=' + ownerId + '&fileId=' + fileId + '\')');
            videoJsPlayer.parentNode.parentNode.appendChild(qualityControlButton);

            placeAfter.style.right = rightOffset + i * 24 + 'px';
        }

        // Находим аудио плееры таким вот способом, waitForElement() часто
        // не помогает, скорее всего, Битрикс добаяляя элементы в документ,
        // устанавливает искомые нами классы позже, уже после добавления
        let findAudioInterval = setInterval(function ()
        {
            let audioContainer = document.querySelectorAll('.crm-audio-cap-wrap-container');

            audioContainer.forEach(function (c)
            {
                if (c.classList.contains('add-btn-processed'))
                {
                    return;
                }

                c.classList.add('add-btn-processed');

                waitForElement('.video-js', c).then(function (player)
                {
                    console.log('.video-js OK');
                    addAudioPlaybackRateButtons(player);
                });
            });
        }, 500);

        if(docType === 'lead') {
            //Прячет кнопку "Сделку + контакт" на странице лида
            let convertButtonStyle = 'button[id$="_convert_button"].ui-btn-extra {background-color: #ddd; border-color: #ddd}'
            let convertLabelStyle = 'button[id$="_convert_label"].ui-btn-main {padding: 0; margin: 0; width: 0; font-size: 0; border-color: #ddd}'
            let convertContainerStyle = 'div.ui-btn-split.ui-btn-primary {border-color: #ddd}'
            appendStyle(convertButtonStyle + convertLabelStyle + convertContainerStyle)

            // Убирает выбор у кнопки "Создать на основании сделку + контакт"
            let buttonMenuStyle = '#entity_progress_success_btn_menu.webform-small-button-right-part {display: none}'
            let buttonContainerStyle = '#entity_progress_success_btn_inner_wrapper.webform-small-button.webform-small-button-accept {padding-right: 18px}'
            appendStyle(buttonMenuStyle + buttonContainerStyle)
            
            // Изменение текста кнопки "Создать на основании сделку + контакт"
            watchDomMutation('#entity_progress_TERMINATION', document.body, (node) => {
                document.querySelector('#entity_progress_success_btn_inner_wrapper > span:nth-child(1)').innerHTML = "Создать "
                /* span = $('#entity_progress_success_btn_inner_wrapper:nth-child(1)')
                span.text(span.text().replace("Создать на основании", "Создать")); */
            })

            /*
            *   Отображение меню выбора линий
            */
            function showPhoneLines(data) {
                DEBUG_MODE == 1 && console.log('phone lines ok')
                DEBUG_MODE == 1 && console.log(data)

                $(document).ready(function() {
                    //Стили меню выбора линий
                    appendStyle(".dropdown {position: relative; display: inline-block; padding: 0 8px; max-width: 36px}\
.dropdown-content {display: none; position: relative; left: -16px; top: 38px; background-color: #f9f9f9; min-width: 140px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2); z-index: 1000;}\
.dropdown:hover .dropdown-content {display: block;}\
.call-line {display: block; height: 2rem; line-height: 2rem;} .call-line:hover {background-color: #eee} .call-line:before {right: 15px !important}")
                    // Пытается создать меню, останавливается как только
                    // оно создано, и добавляет ссылки callto:
                    var id = setInterval(function() {
                        var t = $(".ui-btn-icon-phone-call" )
                        t.after('<div class="dropdown call-lines ui-btn ui-btn-light-border ui-btn-dropdown"><span></span><div class="dropdown-content"></div></div>');
                
                        if($('.call-lines').length) {
                            clearInterval(id)
                            var dropdown = $(".dropdown-content")
                            var phone = getPhoneNumber()
                            for (var i = 0; i < data.length; i++) {
                                dropdown.append(`<a href="callto:${data[i].prefix}${phone}" class="call-line">${data[i].lineName}`)
                            }
                        }
                        console.log(t)
                    }, 500)
                });
            }

            /*
            *   Запрос к API для получения телефонных линий
            */
            function requestPhoneLines(url, callback)
            {
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange = function ()
                {
                    if (this.readyState === 4 && this.status === 200)
                    {
                        try
                        {
                            var responseJSON = JSON.parse(this.responseText);
                        }
                        catch (error)
                        {
                            console.log(error);
                            return;
                        }
                        callback(responseJSON.callLine);
                    }
                };
                xhttp.open('GET', url, true);
                xhttp.send();
            }

            /*
            *   Функция вызова запроса
            */
            function getPhoneLines()
            {
                var url = API_URL + '&doc=' + docType + '&id=' + docId + '&phone=null';
                requestPhoneLines(url,
                    function(data)
                    {
                        showPhoneLines(data)
                    }
                );
            }     
            
            getPhoneLines();
        }

    }


    /*
    * ----------------------------- Обзвон галерея
    */
    if (['deal-list', 'deal-category'].includes(docType))
    {
        useGalleryCarousel();
        appendStyle('.im-phone-call-list-container .owl-carousel .slide{cursor:pointer;/*height:120px;*/}' +
            '.carousel_outer_container{margin-top:10px;padding-bottom:15px;background:#fff;border-bottom:1px solid #edeeef;}' +
            '.owl-carousel .owl-nav button{position:absolute;top:18%;font-size:60px !important;}' +
            '.owl-carousel .owl-nav button.owl-next{right:0}' +
            '.mfp-bg,.mfp-wrap{z-index:1000000 !important}' +
            '.owl-carousel .owl-stage {display:flex;align-items:center;}' +
            '.carousel_outer_container h2.slide__title{text-align:center;text-decoration:underline}');

        watchDomMutation('#im-phone-call-view', document, im_phone_call_view =>
        {
            var carousel_outer_container;
            watchDomMutation('#crm-card-detail-container', im_phone_call_view, async crm_card_detail_container =>
            {
                if (carousel_outer_container)
                {
                    carousel_outer_container.remove();
                    carousel_outer_container = undefined;
                }
                let deal_nodes = crm_card_detail_container.querySelectorAll('.crm-card-show-detail-info-wrap:first-child .crm-card-show-detail-info-main-inner a');
                let ids = [...deal_nodes].map(link => link.href.match(/details\/(\d+)/)[1]);
                const api_data = await getApiData({'do': 'advImage', 'dealID': ids.join(',')});
                if (!api_data || api_data.length === 0)
                {
                    return;
                }
                waitForElement('.im-phone-call-list-container', im_phone_call_view).then(async im_phone_call_list_container =>
                {
                    if (!carousel_outer_container)
                    {
                        carousel_outer_container = document.createElement('div');
                        carousel_outer_container.className = 'carousel_outer_container';
                        const items = im_phone_call_list_container.querySelector('.im-phone-call-list-items-measuring');
                        items.querySelector('.im-phone-call-list-customer-block-active').after(carousel_outer_container);
                    }
                    let adv_body = Object.values(api_data.results.advImage.result)[0];
                    await makeGalleryCarousel(adv_body, {
                            'items': 6,
                            'nav': true,
                            'slideBy': 6,
                            'dots': true,
                            'margin': 8,
                        },
                        carousel_outer_container);
                });
            });
        });
    }



    /*
     * Закрытие окна обзвонов
     */
    function createCallModalCloseButton(argument)
    {
        let phoneCallMain = document.getElementById('popup-window-content-im-phone-call-view')

        if (phoneCallMain)
        {
            let searchPhoneContainer = document.createElement('div');
            searchPhoneContainer.innerHTML = '<div class="im-phone-call-top-close-btn" onclick="closeCallModal(this)"></div>';
            phoneCallMain.appendChild(searchPhoneContainer);
        }
    }

    window.closeCallModal = function (e)
    {
        // let phoneCallView = document.getElementById('popup-window-content-im-phone-call-view');
        // phoneCallView.style.display = 'none';

        // let overlayPhoneCallView = document.getElementById('popup-window-overlay-im-phone-call-view');
        // overlayPhoneCallView.style.display = 'none';

        document.getElementById("popup-window-content-im-phone-call-view").remove();
        document.getElementById("im-phone-call-view").remove();
        document.getElementById("popup-window-overlay-im-phone-call-view").remove();

        document.getElementById('popup-window-content-im-phone-call-view-old').id = 'popup-window-content-im-phone-call-view'
        document.getElementById('im-phone-call-view-old').id = 'im-phone-call-view'
        document.getElementById('popup-window-overlay-im-phone-call-view-old').id = 'popup-window-overlay-im-phone-call-view'
        contentCallWatchCallModal()
    }


    window.callWatchCallModal = function ()
    {
        var phoneCallHeaderInterval = setInterval(function ()
        {
            var contentPhoneCallViewId = document.getElementById('popup-window-content-im-phone-call-view')
            var phoneCallViewId = document.getElementById('im-phone-call-view')

            if (contentPhoneCallViewId || phoneCallViewId)
            {
                createCallModalCloseButton();
                clearInterval(phoneCallHeaderInterval);
            }
        }, 500);
    }

    var phoneCallHeaderInterval = setInterval(function ()
    {
        var contentPhoneCallViewId = document.getElementById('popup-window-content-im-phone-call-view')

        if (contentPhoneCallViewId)
        {
            document.getElementById('popup-window-content-im-phone-call-view').id = 'popup-window-content-im-phone-call-view-old'
            document.getElementById('im-phone-call-view').id = 'im-phone-call-view-old'
            document.getElementById('popup-window-overlay-im-phone-call-view').id = 'popup-window-overlay-im-phone-call-view-old'
            callWatchCallModal()
            clearInterval(phoneCallHeaderInterval);
        }
    }, 500);

    window.contentCallWatchCallModal = function ()
    {
        var phoneCallHeaderInterval = setInterval(function ()
        {
            var contentPhoneCallViewId = document.getElementById('popup-window-content-im-phone-call-view')
            if (contentPhoneCallViewId)
            {
                document.getElementById('popup-window-content-im-phone-call-view').id = 'popup-window-content-im-phone-call-view-old'
                document.getElementById('im-phone-call-view').id = 'im-phone-call-view-old'
                document.getElementById('popup-window-overlay-im-phone-call-view').id = 'popup-window-overlay-im-phone-call-view-old'
                callWatchCallModal()
                clearInterval(phoneCallHeaderInterval);
            }
        }, 500);
    }


};
