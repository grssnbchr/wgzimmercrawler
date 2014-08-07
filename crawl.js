var Crawler = require('crawler').Crawler;
var Moment = require('moment');
var _ = require('underscore');
var Email = require('nodemailer');
var fs = require('fs');
Moment().format();
// define a crawler
var c = new Crawler({
    "maxConnections": 10,
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
var numberToFetch = 100; // number of entries to fetch
var minimalFromDate = '14.9.2014'; // move date before which entries are discarded
var emailReceiver = process.env.CRAWLER_RCVR_MAIL;
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
            console.log("Fetch succeeded");
            var results = $('ul.list li');
            var i = 0;
            results.each(function(index, element) {
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
                        return;
                    }
                    if (object.limited === true) {
                        return;
                    }
                    // check if object is already contained in list array
                    if (_.findWhere(list, object) === undefined) {
                        // if not, send email and add object to list
                        console.log(process.env.CRAWLER_MAIL);
                        transporter.sendMail({
                            from: process.env.CRAWLER_MAIL,
                            to: emailReceiver,
                            subject: 'WGZimmer-Daemon - Vom ' + object.from + ' an frei in "' + object.location + '" für ' + object.cost,
                            text: object.link
                        }, function(err, result) {
                            if (err !== null) {
                                console.log(err);
                            } else {
                                list.push(object);
                            }
                        });
                    }
                }

            });
            // write list to file
            fs.writeFileSync('flats.json', JSON.stringify(list));
        }
    }]);
};
callUri();
setInterval(callUri, interval * 60 * 1000);
