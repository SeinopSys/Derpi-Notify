(function(undefined){

	"use strict";

	const SCOPE = {};

	const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

	const NOTIF_ID = chrome.runtime.getManifest().name;
	const LINKS = {
		parseURL: '/pages/about',
		messages: '/messages',
		notifs: '/notifications',
		signInPage: '/users/sign_in',
	};
	const VALID_DOMAINS = (function(){
		const manif = chrome.runtime.getManifest();
		//jshint -W106
		return manif.permissions.concat(manif.optional_permissions)
			.filter(el => /^http/.test(el))
			.map(el => el.replace(/^https?:\/\/([^/]+)\/$/, '$1'));
	})();
	const VALID_THEMES = ['default', 'dark', 'red', 'auto'];
	const SELECTORS = {
		notifs: '.js-notification-ticker',
		messages: '.fa-embedded--unread-message + *, .fa-embedded--message + *',
		signedIn: 'a.header__link-user',
		username: 'nav > a[href^="/profiles/"]',
	};

	const NOTIFICATION_SOUND = new Audio();
	NOTIFICATION_SOUND.src = 'appointed.ogg';
	NOTIFICATION_SOUND.preload = true;

	const DEFAULT_OPTIONS = {
		badgeColor: "#618fc3",
		preferredDomain: VALID_DOMAINS[0],
		theme: 'auto',
		updateInterval: 60,
		notifEnabled: true,
		notifSound: true,
		notifTimeout: 0,
		notifIcons: true,
	};

	function parseHtml(html){
		return (new DOMParser()).parseFromString(html, "text/html");
	}

	function plural(n,w){
		const s = n !== 1 ? 's' : '';
		return `${n} ${w+s}`;
	}

	function shortenCount(cnt){
		return cnt < 10000
			? cnt+''
			: (
				cnt < 1000000
				? Math.round(cnt/1000)+'k'
				: Math.round(cnt/1000000)+'m'
			);
	}

	// Return values range from 0 to 255 (inclusive)
	// http://stackoverflow.com/questions/11867545#comment52204960_11868398
	function yiq(r,g,b){
		return ((r*299)+(g*587)+(b*114))/1000;
	}

	class ErrorCollection {
		constructor() {
			this._collection = {};
			this.count = 0;
		}

		add(key, message) {
			if (typeof this._collection[key] === 'undefined')
				this._collection[key] = [];
			if ($.isArray(message)){
				this._collection[key] = this._collection[key].concat(message);
				this.count += message.length;
			}
			else {
				this._collection[key].push(message);
				this.count++;
			}
		}

		getAll(){
			return this._collection;
		}

		any(){
			return this.count > 0;
		}
	}

	class Options {
		constructor() {
			this._values = {};
		}

		loadUserOptions() {
			let parsed;
			try {
				parsed = JSON.parse(localStorage.getItem('options'));
			}
			catch (e){}

			let setThese;
			if (typeof parsed !== 'undefined' && parsed !== null)
				setThese = $.extend({}, DEFAULT_OPTIONS, parsed);
			else setThese = DEFAULT_OPTIONS;

			return this.processOptions(setThese);
		}

		setSetting(name, value) {
			return new Promise((res, rej) => {
				const errors = [];
				switch (name){
					case 'badgeColor':
						if (typeof value !== 'string')
							errors.push('Badge color type is invalid');
						else if (!/^#[a-f\d]{6}$/i.test(value))
							errors.push('Badge color format is invalid (must be #RRGGBB)');
						else {
							const rgb = value.substring(1).match(/.{2}/g).map(n => parseInt(n, 16));
							if (yiq(...rgb) > 180)
								errors.push('Badge color is too bright, the number would not be readable');
						}
						break;
					case 'preferredDomain':
						if (typeof value !== 'string' || VALID_DOMAINS.indexOf(value) === -1)
							errors.push('The domain is invalid');
						else {
							checkDomainPermissions(value)
								.then(() => {
									this._resolveSetting(name, value, res);
								})
								.catch(() => {
									errors.push('The extension does not have permission to use the selected domain');
									this._rejectSetting(name, value, errors, rej);
								});
							return;
						}
						break;
					case 'theme':
						if (typeof value !== 'string' || VALID_THEMES.indexOf(value) === -1)
							errors.push('The theme is invalid');
						break;
					case 'updateInterval':
						value = parseInt(value, 10);
						if (isNaN(value) || !isFinite(value))
							errors.push('The update interval must be a number');
						else if (value < 30)
							errors.push('The update interval must be greater than or equal to 30 seconds');
						break;
					case 'notifEnabled':
						if (typeof value !== 'boolean')
							errors.push('Invalid value for notification enable/disable toggle');
						break;
					case 'notifSound':
						if (typeof value !== 'boolean')
							errors.push('Invalid value for notification sound on/off toggle');
						break;
					case 'notifIcons':
						if (typeof value !== 'boolean')
							errors.push('Invalid value for notification button icons on/off toggle');
						break;
					case 'notifTimeout':
						value = parseInt(value, 10);
						if (isNaN(value) || !isFinite(value))
							errors.push('The notification timeout must be a number');
						else if (value < 0)
							errors.push('The notification timeout must be greater than or equal to 0 seconds');
						break;
					default:
						errors.push(`Missing handler for setting ${name}`);
				}

				if (errors.length){
					this._rejectSetting(name, value, errors, rej);
					return;
				}

				this._resolveSetting(name, value, res);
			});
		}

		_rejectSetting(name, value, errors, rej){
			console.error('Failed to set setting', name, value, errors);
			rej(errors);
		}

		_resolveSetting(name, value, res){
			this._values[name] = value;
			this.postSetting(name, value);
			res();
		}

		processOptions(setThese){
			return new Promise(res => {
				const promises = [];
				$.each(setThese, (key, value) => {
					promises.push(
						this.setSetting(key, value)
							.then(
								() => ({ status: true }),
								errors => ({ status: false, key, errors })
							)
					);
				});
				Promise.all(promises).then(results => {
					this.saveOptions();
					res(results);
				});
			});
		}

		saveOptions(){
			localStorage.setItem('options', JSON.stringify(this._values));
		}

		postSetting(name, value) {
			switch (name){
				case 'badgeColor':
					SCOPE.ext.setBadgeColor();
					break;
				case 'updateInterval':
					SCOPE.ext.restartUpdateInterval();
					break;
				case 'notifEnabled':
					if (value === false)
						chrome.notifications.clear(NOTIF_ID);
					break;
				case 'notifTimeout':
					if (value !== 0)
						SCOPE.ext.setNotifTimeout();
			}
		}

		get(name) {
			return this._values[name];
		}

		getAll(){
			return this._values;
		}
	}

	class Extension {
		constructor(){
			this._unread = {
				notifs: 0,
				messages: 0,
			};
			this._buttonIndexes = {
				notifs: -1,
				messages: -1,
			};
			this._meta = {
				signedIn: false,
				username: '',
				autoTheme: VALID_THEMES[0],
			};
		}

		setNotifs(count, fromOnSite = false){
			this._unread.notifs = count === '' ? 0 : parseInt(count, 10);
			this.setBadgeText(fromOnSite);
		}

		setMessages(count, fromOnSite = false){
			this._unread.messages = count === '' ? 0 : parseInt(count, 10);
			this.setBadgeText(fromOnSite);
		}

		setSignedIn(bool){
			this._meta.signedIn = bool;

			if (this._meta.signedIn)
				this.setBadgeSignedIn();
			else this.setBadgeSignedOut();
		}

		setUsername(string){
			this._meta.username = string || '';
		}

		setAutoTheme(bodyDataThemeAttribute){
			this._meta.autoTheme = bodyDataThemeAttribute.split('-')[0];
		}

		setLastCheck(date){
			this._meta.lastCheck = date;
		}

		getPopupData(){
			return {
				notifs: this._unread.notifs,
				messages: this._unread.messages,
				signedIn: this._meta.signedIn,
				username: this._meta.username,
				version: chrome.runtime.getManifest().version,
				domain: SCOPE.prefs.get('preferredDomain'),
				theme: this.getTheme(),
				//lastCheck: this._meta.lastCheck,
			};
		}

		getOptionsData(){
			return {
				prefs: SCOPE.prefs.getAll(),
				version: chrome.runtime.getManifest().version,
				theme: this.getTheme(),
				validDomains: VALID_DOMAINS,
				validThemes: VALID_THEMES,
			};
		}

		getTheme(){
			const setting = SCOPE.prefs.get('theme');
			if (setting === 'auto'){
				if (this._meta.autoTheme)
					return this._meta.autoTheme;
				throw new Error('Auto theme value not found');
			}

			return setting;
		}

		setBadgeText(fromOnSite = false){
			let value = this._unread.notifs + this._unread.messages;
			const newText = value === 0 ? '' : shortenCount(value);
			chrome.browserAction.getBadgeText({}, currentText => {
				if (currentText === newText)
					return;

				chrome.browserAction.setBadgeText({ text: newText });

				if (value === 0 || fromOnSite || (!isNaN(currentText) && currentText > newText))
					return;

				if (SCOPE.prefs.get('notifSound')){
					NOTIFICATION_SOUND.currentTime = 0;
					NOTIFICATION_SOUND.play();
				}
				if (SCOPE.prefs.get('notifEnabled')){
					if (typeof this._clearNotifTimeout === 'number'){
						clearInterval(this._clearNotifTimeout);
						this._clearNotifTimeout = undefined;
					}

					const buttons = [];
					const hasNotifs = this._unread.notifs > 0;
					const displayIcons = SCOPE.prefs.get('notifIcons');
					if (hasNotifs){
						buttons.push({
							title: 'View '+plural(this._unread.notifs, 'Notification'),
							iconUrl: displayIcons ? 'icons/bell.svg' : undefined,
						});
						this._buttonIndexes.notifs = 0;
					}
					else this._buttonIndexes.notifs = -1;
					if (this._unread.messages > 0){
						buttons.push({
							title: 'View '+plural(this._unread.messages, 'Message'),
							iconUrl: displayIcons ? 'icons/envelope.svg' : undefined,
						});
						this._buttonIndexes.messages = hasNotifs ? 1 : 0;
					}
					else this._buttonIndexes.messages = -1;
					const persist = SCOPE.prefs.get('notifTimeout') === 0;
					const notify = {
						type: 'basic',
						iconUrl: 'icons/notif-128.png',
						title: 'Derpibooru',
						message: 'You have unread notifications',
						buttons,
						requireInteraction: persist,
					}
					const doCreateNotify = () => {
						chrome.notifications.create(NOTIF_ID, notify, () => {
							if (!persist)
								this.setNotifTimeout();
						});
					}

					try {
						doCreateNotify()
					} catch(e) {
						if (!isFirefox) throw e // fix does not apply to other browsers
						delete notify.buttons
						delete notify.requireInteraction
						doCreateNotify()
					}
				}
			});
		}

		setBadgeSignedOut(){
			chrome.browserAction.setBadgeBackgroundColor({ color: '#222' });
			chrome.browserAction.setBadgeText({ text: '?' });
		}

		setBadgeSignedIn(){
			const color = SCOPE.prefs.get('badgeColor');
			if (color)
				chrome.browserAction.setBadgeBackgroundColor({ color });
		}

		setBadgeColor(){
			chrome.browserAction.getBadgeText({}, ret => {
				if (ret === '?')
					return;

				this.setBadgeSignedIn();
			});
		}

		setNotifTimeout(){
			this._clearNotifTimeout = setTimeout(() => {
				chrome.notifications.clear(NOTIF_ID);
				this._clearNotifTimeout = null;
			}, SCOPE.prefs.get('notifTimeout') * 1000);
		}

		restartUpdateInterval(){
			if (typeof this._updateInterval !== 'undefined')
				clearInterval(this._updateInterval);
			this._updateInterval = setInterval(checkSiteData, SCOPE.prefs.get('updateInterval') * 1000);
		}

		getButtonIndexes(){
			return this._buttonIndexes;
		}
	}

	SCOPE.prefs = new Options();
	SCOPE.ext = new Extension();
	SCOPE.prefs.loadUserOptions().then(() => {
		checkSiteData();
	});

	function checkSiteData() {
		request(LINKS.parseURL)
			.catch(e => console.log('e', e))
			.then(resp => resp.text())
			.then(resp => {
				SCOPE.ext.setLastCheck(new Date());
				const $page = $(parseHtml(resp));

				const $notifCount = $page.find(SELECTORS.notifs);
				// If user is signed out, bail
				if ($notifCount.length === 0){
					SCOPE.ext.setBadgeSignedOut();
					return;
				}
				SCOPE.ext.setBadgeSignedIn();
				SCOPE.ext.setNotifs($notifCount.text());
				const $messageCount = $page.find(SELECTORS.messages);
				SCOPE.ext.setMessages($messageCount.text());
				SCOPE.ext.setBadgeText();
				SCOPE.ext.setSignedIn($page.find(SELECTORS.signedIn).length > 0);
				SCOPE.ext.setUsername($page.find(SELECTORS.username).text());
				SCOPE.ext.setAutoTheme($page.find('body').attr('data-theme'));
			});
	}


	function makeURLFromPath(url){
		return `https://${SCOPE.prefs.get('preferredDomain')}${url}`;
	}

	function request(path, params = {}) {
		params.credentials = 'include';
		return fetch(makeURLFromPath(path), params);
	}

	function openNotifsPage(){
		chrome.tabs.create({ url: makeURLFromPath(LINKS.notifs) });
	}

	function openMessagesPage(){
		chrome.tabs.create({ url: makeURLFromPath(LINKS.messages) });
	}

	chrome.runtime.onMessage.addListener((req, sender, resp) => {
		switch (req.action){
			case 'updateOptions':
				SCOPE.prefs.processOptions(req.data)
					.then(results => {
						let failed = results.filter(el => !el.status);
						if (failed.length){
							const errors = new ErrorCollection();
							failed.forEach(el => {
								errors.add(el.key, el.errors);
							});
							resp({
								status: false,
								errors: errors.getAll(),
							});
						}
						else {
							SCOPE.prefs.saveOptions();
							resp({ status: true });
						}
					});
				return true;
			case 'openSignInPage':
				chrome.tabs.create({ url: makeURLFromPath(LINKS.signInPage) });
				break;
			case 'getSelectors':
				resp({
					sel: SELECTORS,
					onlyDomain: SCOPE.prefs.get('preferredDomain'),
				});
				break;
			case 'onSiteUpdate':
				SCOPE.ext.setMessages(req.data.messages);
				SCOPE.ext.setNotifs(req.data.notifs);
				SCOPE.ext.setSignedIn(req.data.signedIn);
				SCOPE.ext.setUsername(req.data.username);
				SCOPE.ext.setAutoTheme(req.data.theme);
				SCOPE.ext.restartUpdateInterval();
				break;
			case 'getPopupData':
				resp(SCOPE.ext.getPopupData());
				break;
			case 'getOptionsData':
				resp(SCOPE.ext.getOptionsData());
				break;
			case 'openNotifisPage':
				openNotifsPage();
				break;
			case 'openMessagesPage':
				openMessagesPage();
				break;
			default:
				throw new Error(`No handler defined for action ${req.action}`);
		}
	});

	chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
		const ixs = SCOPE.ext.getButtonIndexes();
		switch (btnIdx){
			case ixs.notifs:
				openNotifsPage();
			break;
			case ixs.messages:
				openMessagesPage();
			break;
		}
		chrome.notifications.clear(notifId);
	});

})();
