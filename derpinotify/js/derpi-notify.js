(function() {

	"use strict";

	// Avoid re-sending data from a cached page
	if (!!window.performance && window.performance.getEntriesByType('navigation')[0].type === "back_forward")
		return;

	const isFirefox = 'browser' in window;

	const callback = resp => {
		if (resp.onlyDomain !== location.host)
			return;

		const qs = s => document.querySelector(s);

		const $notifs = qs(resp.sel.notifs);
		const $messages = qs(resp.sel.messages);
		const $username = qs(resp.sel.username);
		const data = {
			notifs: $notifs ? $notifs.innerText : '',
			messages: $messages ? $messages.innerText : '',
			signedIn: !!qs(resp.sel.signedIn),
			username: $username ? $username.innerText : '',
			theme: qs('body').dataset.theme,
		};

		chrome.runtime.sendMessage({ action: "onSiteUpdate", data });
	};

	if (!isFirefox)
		chrome.runtime.sendMessage({ action: "getSelectors" }, callback);
	else browser.runtime.sendMessage({ action: "getSelectors" }).then(callback);

})();
