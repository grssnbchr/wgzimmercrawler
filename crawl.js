var Crawler = require('crawler').Crawler;
var Moment = require('moment');
var _ = require('underscore');
var Email = require('nodemailer');
var fs = require('fs');
var async = require('async');
Moment().format();
// define a crawler
var c = new Crawler({
    'maxConnections': 10,
    'cache': false
});
// define an Email transporter
var transporter = Email.createTransport({
    service: 'yahoo',
    auth: {
        user: process.env.CRAWLER_MAIL,
        pass: process.env.CRAWLER_PWD
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
// read list from file

var interval = 10; // in minutes
var numberToFetch = 200; // number of entries to fetch
var minimalFromDate = '20.9.2014'; // move date before which entries are discarded
var emailReceiver = process.env.CRAWLER_RCVR_MAIL;
var i = 0;
var onMailSendComplete = function(err) {
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
}
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
                from: process.env.CRAWLER_MAIL,
                to: emailReceiver,
                subject: 'WGZimmer-Daemon - ' + object.created + ' Vom ' + object.from + ' an frei in "' + object.location + '" für ' + object.cost,
                text: object.link
            }, function(err, result) {
                console.log(result.response);
                if (err !== null) {
                    console.log('mail sending failed: ' + err.response);
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
        'form': 'query=&priceMin=500&priceMax=1500&state=zurich-stadt&student=none&country=ch&orderBy=MetaData%2F%40mgnl%3Alastmodified&orderDir=descending&startSearchMate=true&wgStartSearch=true',
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
