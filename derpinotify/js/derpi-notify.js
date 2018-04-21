(function() {

	"use strict";

	chrome.runtime.sendMessage({ action: "getSelectors" }, resp => {
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
	});

})();
