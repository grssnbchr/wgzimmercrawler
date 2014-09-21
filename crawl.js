/* 
 * crawl.js
 * a crawler for the incredibly shitty wgzimmer.ch website
 * regularly visits wgzimmer.ch and fetches all the new (!) ads that conform to user-adjustable criteria
 * then sends out an email with the new entries to
 * no license!
 */
var Crawler = require('crawler').Crawler;
var Moment = require('moment');
var _ = require('underscore');
var Email = require('nodemailer');
var fs = require('fs');
var async = require('async');
Moment().format();

// configurations
var interval = 10; // interval of starting the crawling process (in min)
var numberToFetch = 20; // number of entries to fetch during one crawling process (before filtering)
// filters
var minimalFromDate = '10.9.2014'; // data before which entries are discarded
var emailReceiver = process.env.CRAWLER_RCVR_MAIL; //define this variable in your .bashrc (to run locally) or in herou, this is the email address that will receive your mails
// emailing
var emailHost = 'smtp.geo.uzh.ch'; // insert your SMTP host here
var emailPort = 465; // the SMTP port you're using
var emailSecure = true; // wether or not to use TSL/SSL for SMTP server
var emailSender = process.env.CRAWLER_MAIL; // define this variable in your .bashrc (to run locally) or in herou, this is the email address that will be used as SMTP address
var emailPwd = process.env.CRAWLER_PWD; // define this variable in your .bashrc (to run locally) or in herou, the password for the above SMTP account
var minPrice = 700; // minimal price you're looking for
var maxPrice = 1500; // minimal price you're looking for
var country = 'ch'; // country to look for results in
var state = 'zurich-stadt'; // geographical entity to search for (reverse-engineer wgzimmer.ch for further possibilities)

// define a crawler
var c = new Crawler({
    'maxConnections': 10,
    'cache': false
});
// define an Email transporter
var transporter = Email.createTransport({
    // service: 'yahoo',
    host: emailHost,
    port: emailPort,
    secure: emailSecure,
    auth: {
        user: emailSender,
        pass: emailPwd
    }
});

if (!String.prototype.contains) {
    String.prototype.contains = function() {
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}
var dateParser = function(inputDate) {
    return Moment(inputDate, 'DD.MM.YYYY');
};
var list = JSON.parse(fs.readFileSync('flats.json', {
    encoding: 'utf8'
}));



var i = 0;

// read list from file
var onMailSendComplete = function(err) {
    // reset i
    i = 0;
    if (err) {
        console.log(err);
    } else {
        // write list to file
        fs.writeFile('flats.json', JSON.stringify(list), function(err) {
            if (err) {
                console.log(err);
            } else {
                console.log('The file was saved!');
            }
        });
    }
};
var sendMail = function($, element, callback) {
    if (i++ < numberToFetch) {
        // link
        var link = 'http://www.wgzimmer.ch' + $($(element).find('a')[1]).attr('href');
        // creation date
        var createDate = $(element).find('.create-date').text().trim();
        // location
        var location = $(element)
            .find('.state')
            .clone()
            .children()
            .remove()
            .end()
            .text().trim();
        // from when on
        var fromDate = $(element).find('.from-date')
            .children('strong')
            .text().trim();
        // limited
        var limited = $(element)
            .find('.from-date')
            .clone()
            .children()
            .remove()
            .end()
            .text()
            .trim()
            .toLowerCase()
            .contains('unbefristet');
        // cost
        var cost = $(element).find('.cost')
            .children('strong')
            .text().trim();
        var object = {
            'created': createDate,
            'from': fromDate,
            'limited': !limited,
            'cost': cost,
            'link': link,
            'location': location
        };
        // check if object satisfies criteria
        if (dateParser(object.from) < dateParser(minimalFromDate)) {
            callback(null);
            return;
        }
        if (object.limited === true) {
            callback(null);
            return;
        }
        // check if object is already contained in list array
        if (_.findWhere(list, object) === undefined) {
            // if not, send email and add object to list
            transporter.sendMail({
                from: emailReceiver,
                to: emailReceiver,
                subject: 'WGZimmer-Daemon - ' + object.created + ' From ' + object.from + ' on available in "' + object.location + '" for ' + object.cost,
                text: object.link
            }, function(err, result) {
                if (err !== null) {
                    console.log('mail sending failed: ' + err);
                } else {
                    console.log('mail sent');
                    list.push(object);
                }
                callback(null);
            });
        } else {
            console.log('object already in list');
            callback(null);
        }
    } else {
        callback(null);
    }
};

var callUri = function() {
    console.log("Starting fetch...");
    c.queue([{
        'uri': 'http://www.wgzimmer.ch/wgzimmer/search/mate.html?',
        'method': 'POST',
        'timeout': 10000,
        'form': 'query=&priceMin=' + minPrice + '&priceMax=' + maxPrice + '&state=' + state + '&student=none&country=' + country + '&orderBy=MetaData%2F%40mgnl%3Alastmodified&orderDir=descending&startSearchMate=true&wgStartSearch=true',
        'callback': function(error, result, $) {
            if (error !== null) {
                console.log(error);
                return;
            }
            console.log('fetch succeeded');
            var results = $('ul.list li');
            // start asynchronous email sending
            async.each(results, sendMail.bind(null, $), onMailSendComplete);
        }
    }]);
};
callUri();
setInterval(callUri, interval * 60 * 1000);
