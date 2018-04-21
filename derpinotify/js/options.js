(function() {

	"use strict";

	// Convert .serializeArray() result to object
	$.fn.mkData = function(obj) {
		let tempData = this.find(':input:valid').serializeArray(), data = {};
		$.each(tempData, function(i, el) {
			if (/\[]$/.test(el.name)){
				if (typeof data[el.name] === 'undefined')
					data[el.name] = [];
				data[el.name].push(el.value);
			}
			else data[el.name] = el.value;
		});
		if (typeof obj === 'object')
			$.extend(data, obj);
		return data;
	};

	// Make the first letter of the first or all word(s) uppercase
	$.capitalize = str => {
		return str.length === 1 ? str.toUpperCase() : str[0].toUpperCase()+str.substring(1);
	};

	$.fn.hasAttr = function(attr){
		const el = this.get(0);
		return el && el.hasAttribute(attr);
	};

	// :valid pseudo polyfill
	if (typeof $.expr[':'].valid !== 'function')
		$.expr[':'].valid = el => typeof el.validity === 'object' ? el.validity.valid : ((el) => {
			let $el = $(el),
				pattern = $el.attr('pattern'),
				required = $el.hasAttr('required'),
				val = $el.val();
			if (required && (typeof val !== 'string' || !val.length))
				return false;
			if (pattern)
				return (new RegExp(pattern)).test(val);
			else return true;
		})(el);

	const $version = $('#version');
	const $form = $('#options-form');
	const $submitButton = $('#submit-button');
	const $savingSettings = $('#saving-settings');
	const $badgeColor = $('#badgeColor');
	const $preferredDomain = $('#preferredDomain');
	const $updateInterval = $('#updateInterval');
	const $notifEnabled = $('#notifEnabled');
	const $notifSound = $('#notifSound');
	const $notifTimeout = $('#notifTimeout');
	const $notifIcons = $('#notifIcons');
	const $theme = $('#theme');
	const $themeLink = $(document.createElement('link')).attr('rel','stylesheet').appendTo('head');

	function getOptionsData(){
		chrome.runtime.sendMessage({ action: "getOptionsData" }, function(response) {
			$themeLink.attr('href',`css/theme-${response.theme}.css`);
			$version.text('v'+response.version);

			$badgeColor.val(response.prefs.badgeColor).spectrum({
				color: response.prefs.badgeColor,
				showInput: true,
				preferredFormat: "hex",
				allowEmpty: false,
				cancelText: 'close',
				chooseText: 'Set',
				showPalette: true,
				showSelectionPalette: false,
				palette: [
					['#000'],
					['#555'],
					['#618fc3'],
					['#08f'],
					['#0a0'],
					['#e80'],
					['#d00'],
					['#e0e'],
					['#80f'],
				],
			});
			$updateInterval.val(response.prefs.updateInterval);
			$notifEnabled.prop('checked', response.prefs.notifEnabled);
			$notifSound.prop('checked', response.prefs.notifSound);
			$notifIcons.prop('checked', response.prefs.notifIcons);
			$notifTimeout.val(response.prefs.notifTimeout);
			$preferredDomain.empty();
			$.each(response.validDomains, (_, el) => {
				$preferredDomain.append(
					$(document.createElement('option'))
						.attr('selected', el === response.prefs.preferredDomain)
						.text(el)
				);
			});
			$theme.empty();
			$.each(response.validThemes, (_, el) => {
				$theme.append(
					$(document.createElement('option'))
						.attr('value', el)
						.attr('selected', el === response.prefs.theme)
						.text($.capitalize(el))
				);
			});
		});
	}
	getOptionsData();

	function sub(enable){
		$submitButton.attr('disabled', !enable);
		$savingSettings[enable?'addClass':'removeClass']('hidden');
	}

	function updateOptions(data){
		console.log('updateOptions', data);
		chrome.runtime.sendMessage({ action: "updateOptions", data }, function(response) {
			console.log(response);

			sub(true);

			$form.find('.error').remove();

			if (response.status){
				getOptionsData();
			}
			else {
				$.each(response.errors, (key, errors) => {
					const $field = $(`#${key}`).closest('.field');
					const $ul = $(document.createElement('ul')).attr('class','error');
					errors.forEach(el => {
						$ul.append(
							$(document.createElement('li')).text(el)
						);
					});
					$field.append($ul);
				});
			}
		});
	}
	$form.on('submit', e => {
		e.preventDefault();
		sub(false);

		const data = {
			badgeColor: $badgeColor.val(),
			preferredDomain: $preferredDomain.val(),
			theme: $theme.val(),
			updateInterval: $updateInterval.val(),
			notifEnabled: $notifEnabled.prop('checked'),
			notifSound: $notifSound.prop('checked'),
			notifTimeout: $notifTimeout.val(),
			notifIcons: $notifIcons.prop('checked'),
		};

		checkDomainPermissions(data.preferredDomain)
			.then(() => { updateOptions(data) })
			.catch(() => {
				requestDomainPermission(data.preferredDomain)
					.then(() => { updateOptions(data) })
					.catch(() => {
						delete data.preferredDomain;
						updateOptions(data);
					});
			});
	});

})();
