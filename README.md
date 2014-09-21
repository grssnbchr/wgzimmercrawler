wgzimmercrawler
=============================

If you are ever looking for a shared flat but don't want to always check manually on http://wgzimmer.ch (which has a terrible UI),
this crawler is for you.

how to install
-----------------------------
* needs nodejs and npm! 
* `git clone https://github.com/wnstnsmth/wgzimmercrawler.git`
* `npm install`


how to run
-----------------------------
* fire up your favourite editor and modify lines 17 to 31 in crawl.js to suit your needs
* in order for emailing to work, you need to add configuration variables in your environment (often, .bashrc), but you
* can also add the email addresses and passwords directly in crawl.js 
* if you plan to host the project on heroku (which is recommended because it only needs one worker - one is free - and then runs
* all the time, 24/7, which lets you react quickly to new flats), they have a very good node introduction on https://devcenter.heroku.com/articles/getting-started-with-nodejs#introduction
* here, the Procfile is already ready & set
* so, to run locally, just do this: `node crawl.js`
* flats.json will be populated so that flats which you already have been notified about are not sent to you twice

