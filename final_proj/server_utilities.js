

//https://stackoverflow.com/questions/175739/how-can-i-check-if-a-string-is-a-valid-number
function isNumeric(str) {

    if (typeof str != "string") {

        return false // we only process strings!  

    }

    return (!isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
           !isNaN(parseFloat(str))) // ...and ensure strings of whitespace fail

}

const MIME_TYPES = {
    'css': 'text/css',
    'gif': 'image/gif',
    'htm': 'text/html',
    'html': 'text/html',
    'ico': 'image/x-icon',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'js': 'application/javascript', 
    'json': 'application/json',
    'png': 'image/png',
    'svg': 'image/svg+xml',
    'txt': 'text/plain'
}

function get_mime(filename) {

    for (let ext in MIME_TYPES) {

        if (filename.indexOf(ext, filename.length - ext.length) !== -1) {

            return MIME_TYPES[ext]

        }

    }

    return MIME_TYPES['txt']

}

function isDecimal(n) {
   var result = (n - Math.floor(n)) !== 0; 
   
  if (result)
    return 'Number has a decimal place.';
   else
     return 'It is a whole number.';
}

function formatTime(time_string) {

    let time = time_string.split(':')

    if ( time.length === 3 ) {

        return {

            'hours': time[0],
            'minutes': time[1],
            'seconds': time[2]

        }

    }

    console.log("ERROR: " + JSON.stringify(time))

    return null

}

function formatTimeToStr( time_obj ) {

    if ( time_obj.hours.toString().length < 2 ) {

        time_obj.hours = "0" + time_obj.hours

    }

    if ( time_obj.minutes.toString().length < 2 ) {

        time_obj.minutes = "0" + time_obj.minutes

    }

    if ( time_obj.seconds.toString().length < 2 ) {

        time_obj.seconds = "0" + time_obj.seconds

    }

    return time_obj.hours + ":" + time_obj.minutes + ":" + time_obj.seconds

}

function incrementTime( time_string, hours = 0, minutes = 0, seconds = 0 ) {

    let time_obj = formatTime(time_string)

    let time_minutes = parseInt(time_obj.minutes)
    let time_hours = parseInt(time_obj.hours)
    let time_seconds = parseInt(time_obj.seconds)

    if ( seconds > 0 ) {

        if ( time_seconds + seconds >= 60 ) {

            minutes += 1

        }

        time_seconds += seconds % 60

    }

    if ( minutes > 0 ) {

        if ( time_minutes + minutes >= 60 ) {

            hours += 1

        }

        time_minutes += minutes % 60

    }

    if ( hours > 0 ) {

        if ( time_hours + hours >= 24 ) {

            return //Outside the scope of this function no date parameters and not a use case for this application

        }

        time_hours += hours

    }


    time_obj.hours = time_hours
    time_obj.seconds = time_seconds
    time_obj.minutes = time_minutes

    return formatTimeToStr(time_obj)

}

function decrementTime( time_string, hours = 0, minutes = 0, seconds = 0 ) {

    let time_obj = formatTime(time_string)

    if ( seconds > 0 ) {

        if ( time_obj.seconds - seconds < 0 ) {

            time_obj.seconds = 0
            minutes += 1

        } else {

            time_obj.seconds -= seconds

        }

    }

    if ( minutes > 0 ) {

        if ( time_obj.minutes - minutes < 0 ) {

            time_obj.minutes = 60 +  ( time_obj.minutes - minutes )
            hours += 1

        } else {

            time_obj.minutes -= minutes

        }

    }

    if ( hours > 0 ) {

        if ( time_obj.hours - hours < 0 ) {

            return //Outside the scope of this function as no date parameter -> abort

        }

        time_obj.hours -= hours

    }

    return formatTimeToStr(time_obj)

}

function getCurrentDate() {

    let date = new Date()

    return date.toISOString().split('T')[0]

}

function deepCopy(obj) {

    return JSON.parse(JSON.stringify(obj))

}

function apptThatDate(date, appt_list) {

    for ( let i = 0; i < appt_list.length; i++ ) {

        let date_obj = formatDate(date)
        let pt_date_obj = formatDate( convertDateToString(appt_list[i].pt_date) )

        if ( sameDates(date_obj, pt_date_obj) === true ) {

            return true

        }

    }

    return false

}

function dateLessThan(date1, date2) {

    date1 = formatDate(date1)
    date2 = formatDate(date2)

    if ( date1.year === date2.year ) {

        if ( date1.month === date2.month ) {

            if ( date1.day < date2.day ) {

                return true

            } else {

                return false

            }

        } else if ( date1.month < date2.month ) {

            return true

        } else {

            return false

        }

    } else if ( date1.year < date2.year ) {

        return true

    }

    return false

}

function formatDateYMDObj(date_string) {

    let date = date_string.split('-')

    if ( date.length < 3 ) { //Should not be the case -> just for safety

        console.log("SHOULD NOT BE HERE: READ NEXT LINE")
        console.log(JSON.stringify(date))
        return null

    }


    return {

        'day': parseInt(date[2]),
        'month': parseInt(date[1]),
        'year': parseInt(date[0])

    }

}

function incrementDays(date, days = 0, months = 0, years = 0) {

    let date_day = parseInt(date.day)
    let date_month = parseInt(date.month)
    let date_year = parseInt(date.year)
    
    date_day += days

    if ( ( (date_month === 1) || (date_month === 3) || (date_month === 5)  ||
           (date_month === 7) || (date_month === 8) || (date_month === 10) || 
           (date_month === 12) ) && (date_day > 31) ) {

        date_day = date_day % 31
        months += 1

    }

    if ( ( (date_month === 4) || (date_month === 6) || (date_month === 9) ||
           (date_month === 11) ) && (date_day > 30) ) {

        date_day = date_day % 30
        months += 1

    }

    if ( ( date_month === 2 ) && ( date_day > 28 ) ) {

        date_day = date_day % 28
        months += 1

    }

    date_month += months

    if ( date_month > 12 ) {

        date_month = date_month % 12
        years += 1

    }

    date_year += years

    date.month = date_month.toString()
    date.year = date_year.toString()
    date.day = date_day.toString()

    return date

}

function formatDate( date_string ) {

    let date = date_string.split('-')

    if ( date.length < 3 ) { //Should not be the case -> just for safety

        console.log("SHOULD NOT BE HERE: READ NEXT LINE")
        console.log(JSON.stringify(date))
        return null

    }


    return {

        'day': date[1],
        'month': date[2],
        'year': date[0]

    }

}

function sameDates(date1, date2) {

    if ( (date1.year === date2.year) &&
         (date1.month === date2.month) &&
         (date1.day === date2.day) ) {

        return true

    }

    return false

}

function dateLess(date1, date2) {

    if ( date1.year < date2.year ) return true
    if ( date1.year > date2.year ) return false
    if ( date1.month < date2.month ) return true
    if ( date1.month > date2.month ) return false
    if ( date1.day <= date2.day ) return true
    if ( date1.day > date2.day ) return false
    return false

}

function calculateTimeDifference(time_obj1, time_obj2) {

    let time_diff =  (parseInt(time_obj2.hours) - parseInt(time_obj1.hours)) * 60 + parseInt(time_obj2.minutes) - parseInt(time_obj1.minutes)

    if ( time_diff < 0 ) {

        return time_diff * -1

    }

    return time_diff

}

function convertDateToStringYMD( dateObj ) {

    return dateObj.year + '-' + dateObj.month + '-' + dateObj.day

}

function convertDateToString( dateObj ) {

    return dateObj.year + '-' + dateObj.day + '-' + dateObj.month

}

function formatDateMDY( date_str ) {

    let date_obj = formatDate(date_str)

    return date_obj.month + "-" + date_obj.day + "-" + date_obj.year

}

function formatDateYMD( date_str ) {

    let date_obj = formatDate(date_str)

    return date_obj.year + "-" + date_obj.day + "-" + date_obj.month

}

function formatDateDMY (date_str) {

    let date = date_str.split('-')

    if ( date.length < 3 ) {

        return

    }

    return {

        'day': date[2],
        'month': date[1],
        'year': date[0]

    }

}

module.exports =  { dateLessThan, incrementDays, getCurrentDate, 
    decrementTime, incrementTime, get_mime, isDecimal, isNumeric, 
    formatTime, formatTimeToStr, deepCopy, convertDateToString, formatDateMDY,
    formatDateDMY, sameDates, apptThatDate, formatDate, calculateTimeDifference,
    formatDateYMD, formatDateYMDObj, dateLess, convertDateToStringYMD
}