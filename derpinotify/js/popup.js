(function(){
	"use strict";

	const $html = $('html');
	const $body = $('body');
	const $themeLink = $(document.createElement('link')).attr('rel','stylesheet').appendTo('head');
	function resize(w){
		$html.css('width', w);
		$body.css('width', w);
	}
	resize(400);

	const $signInStatus = $('#sign-in-status');
	const $version = $('#version');
	const $notifCount = $('#notif-count');
	const $messageCount = $('#message-count');
	const $notifContainer = $('#notif-container');
	const $messageContainer = $('#message-container');
	const $options = $('#options');

	$notifContainer.prepend($(fa.bell).addClass('icon-image')).on('click', e => {
		e.preventDefault();
		chrome.runtime.sendMessage({ action: "openNotifsPage" });
	});
	$messageContainer.prepend($(fa.envelope).addClass('icon-image')).on('click', e => {
		e.preventDefault();
		chrome.runtime.sendMessage({ action: "openMessagesPage" });
	});
	$options.on('click', e => {
		e.preventDefault();
		chrome.runtime.openOptionsPage();
	});

	chrome.runtime.sendMessage({ action: "getPopupData" }, function(response) {
		$version.text('v'+response.version);
		$themeLink.attr('href',`css/theme-${response.theme}.css`);
		if (response.signedIn){
			$signInStatus.empty().append(
				'For ',
				$(document.createElement('strong')).text(response.username),
				' from ',
				$(document.createElement('strong')).text(response.domain)
			);
			if (response.notifs === 0){
				$notifContainer.addClass('inactive');
				$notifCount.empty();
			}
			else $notifCount.text(response.notifs);
			if (response.messages === 0){
				$messageContainer.addClass('inactive');
				$messageCount.empty();
			}
			else $messageCount.text(response.messages);
		}
		else $signInStatus.html(`<button id="sign-in" class="button">Sign in</button>`);
		$signInStatus.removeClass('hidden');
	});

	$body.on('click','#sign-in', function(e){
		e.preventDefault();
		chrome.runtime.sendMessage({ action: "openSignInPage" });
	});
})();
