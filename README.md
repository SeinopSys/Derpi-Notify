# Derpi-Notify

Keep track of your Derpibooru notifications and messages in (almost) real time


<p align="center"><a href="https://chrome.google.com/webstore/detail/derpi-notify/injlokbojlfffbonihefcbhikkkpepgn"><img src="https://developer.chrome.com/webstore/images/ChromeWebStore_BadgeWBorder_v2_340x96.png" alt="Download Derpi-Notify from the Chrome Web Store"></a> <a href="https://addons.mozilla.org/en-US/firefox/addon/derpi-notify/"><img src="https://cdn.rawgit.com/alrra/browser-logos/da2477b1/src/firefox/firefox.svg" height="96" alt="Download Derpi-Notify from Firefox Add-ons"></a></p>

## How does it work?

The extension sends a request to the About page (which is the most lightweight page on the site) every `N` seconds (which can be adjusted in the options) and looks for the notification and message counters on the page.

The total amount is then displayed on the icon, and when clicked it opens a menu that looks similar to the site's top bar with the notifications and messages icons, both of which can be clicked to go to their respective pages. You should choose the domain you're normally signed in on using the options, otherwise the extension can't keep count of your notifications and messages.

If you browse the site on the domain of your choosing the extension will keep the count synced with the page contents without having to wait for the next timed update.

By default the the extension sends a notification and plays a sound when the total increases, but both the notification and its sound can be disabled if you only want the counter. The notification also disappears after a few seconds initially, but this can be changed to a longer duration or disabled entirely (by setting the timeout to 0), so only a click on the close button or one of the buttons will clear it.

## Attributions

 - Notificaton sound: [Appointed](https://notificationsounds.com/message-tones/appointed-529) from [NotificationSounds.com](https://notificationsounds.com)
 - Application icon: based on [Trixie CM](https://ambassad0r.deviantart.com/art/Trixie-CM-564230189) by [Ambassad0r](https://ambassad0r.deviantart.com/)
 - Icons: [Font Awesome](https://fontawesome.com/license) v5.0.10
 - Color picker: [Spectrum](https://bgrins.github.io/spectrum/)
