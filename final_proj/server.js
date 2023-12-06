const ONE_DAY = 1000 * 60 * 60 * 24
const express = require('express')
const app = express()
const utilities = require('./server_utilities.js')
const session = require('express-session')
const { Client } = require('pg')
const users = new Map() //keep track of users currently logged in
const trainers = new Map() //Keep track of trainers currently logged in
const admins = new Map() //Keep track of the admins currently logged in

app.use(express.urlencoded({ extended: false }))
app.use(express.json());
app.use(express.raw());

const client = new Client({
    host: "localhost",
    user: "postgres",
    port: "5432",
    password: "postgres",
    database: "postgres"
})

client.connect()

app.use(session({
    secret: 'secret-key',
    saveUninitialized: false,
    cookie: { maxAge: ONE_DAY },
    resave: false
}))

//Middleware
app.use(express.static(__dirname + '/html')) //static server

app.get('/get_goal_setting_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/user_goals.html' } )

    }

})

app.get(__dirname + '/html/user_login.html', (request, response) => {

    response.sendFile(__dirname + '/html/user_login.html')

})

app.get('/get_goal_viewing_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send( {'file_name': __dirname + '/html/view_user_goals.html'} )

    }

})

app.get('/get_schedule_page', (request, response)=> {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/view_schedule_page.html'} )
    }

})

app.get(__dirname + '/html/view_schedule_page.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/view_schedule_page.html')

    }

})

app.get('/get_schedule', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let schedule = []
        let query_classes_taken = "SELECT class_id FROM users_taking_class WHERE member_id='" + user_name + "';"
        let query_pt_sessions_taken = "SELECT trainer_id, room_id, start_time, end_time, pt_date FROM pt_sessions WHERE member_id='" + user_name + "';"

        let classes_added = false
        let pt_sessions_added = false

        client.query(query_classes_taken, (err, res_classes) => {

            if ( err ) {

                console.log("There was an error in getting the classes.")
                console.log(err.message)

            } else {

                if ( res_classes.rowCount === 0 ) {

                    classes_added = true

                    if ( pt_sessions_added === true ) {

                        classes_added = false
                        response.send( { 'schedule': schedule } )

                    }

                }

                for ( let i = 0; i < res_classes.rowCount; i++ ) {

                    let query_class_details = "SELECT * FROM classes WHERE class_id='" + res_classes.rows[i].class_id + "';"

                    client.query( query_class_details, (err, res) => {

                        if ( err ) {

                            console.log("There was an error in getting the classes.")
                            console.log(err.message)

                        } else {

                            let date = new Date(res.rows[0].class_date)

                            res.rows[0].class_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]))

                            let query_trainer_name = "SELECT first_name, last_name FROM trainers WHERE trainer_id='" + res.rows[0].trainer_id + "';"

                            client.query(query_trainer_name, (err, result) => {

                                if ( err ) {

                                    console.log("Error in querying the trainer name.")
                                    console.log(err.message)

                                } else {

                                    if ( result.rowCount === 0 ) {

                                        console.log("There is no trainer with the given id.")

                                    } else {

                                        res.rows[0].trainer_name = result.rows[0].first_name + " " + result.rows[0].last_name

                                    }

                                    schedule = schedule.concat(res.rows)

                                    if ( i === res_classes.rowCount - 1 ) {

                                        classes_added = true

                                        if ( pt_sessions_added === true ) { //Asynchronous (Don't know what will occur first)

                                            classes_added = false
                                            response.send( { 'schedule': schedule } )

                                        }

                                    }

                                }

                            })

                        }

                    })

                }

            }

        })


        client.query(query_pt_sessions_taken, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the PT Sessions with this user.")
                console.log(err.message)

            } else {

                let trainer_names_obtained = false

                if ( res.rowCount === 0 ) {

                    trainer_names_obtained = true

                }

                for ( let i = 0; i < res.rowCount; i++ ) {

                    let date = new Date(res.rows[i].pt_date)

                    res.rows[i].pt_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]))

                    let query_trainer_name = "SELECT first_name, last_name FROM trainers WHERE trainer_id='" + res.rows[i].trainer_id + "';"

                    client.query(query_trainer_name, (err, result) => {

                        if ( err ) {

                            console.log("There was an error in querying the trainer name.")
                            console.log(err.message)

                        } else {

                            if ( result.rowCount === 1 ) { //Add the trainer name if trainer exists

                                res.rows[i].trainer_name = result.rows[0].first_name + " " + result.rows[0].last_name

                            }

                            if ( i === res.rowCount - 1 ) {

                                trainer_names_obtained = true

                                schedule = schedule.concat(res.rows)

                                pt_sessions_added = true

                                if ( classes_added === true ) { //Asynchronous (Don't know what will occur first)

                                    pt_sessions_added = false
                                    response.send( { 'schedule': schedule } )

                                }

                            }

                        }

                    })

                }

                if ( trainer_names_obtained === true ) {

                    schedule = schedule.concat(res.rows)

                    pt_sessions_added = true

                    if ( classes_added === true ) { //Asynchronous (Don't know what will occur first)

                        pt_sessions_added = false
                        response.send( { 'schedule': schedule } )

                    }

                }

            }

        })

    }

})

app.get('/get_goals', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let query = "SELECT date_goal_set, weight_goal, daily_exercise_minutes, daily_caloric_intake FROM user_goals WHERE user_name='" + user_name + "';"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the users' goals.")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) {

                    response.send( { 'goals': res.rows } )

                } else {


                    for ( let i = 0; i < res.rowCount; i++ ) {

                        let date = new Date(res.rows[i].date_goal_set)

                        res.rows[i].date_goal_set = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]))

                    }

                    response.send( {'goals': res.rows } )

                }
            }
        })

    }

})

app.get(__dirname + '/html/view_user_goals.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/view_user_goals.html')

    }

})


app.get(__dirname + '/html/user_goals.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/user_goals.html')

    }

})

app.get('/request_room_bookings_page', (request, response) => {

    if ( admins.has(request.session.id) === true ) {

        let file_name = { 'file_name': __dirname + '/html/view_room_bookings.html'}

        response.send(file_name)


    } else {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    }

})

app.get(__dirname + '/html/admin_login.html', (request,response) => {

    response.sendFile(__dirname + '/html/admin_login.html')

})

app.get('/request_room_bookings', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let query_get_rooms = "SELECT * FROM rooms;"

        client.query(query_get_rooms, (err, room_res) => {

            if ( err ) {

                console.log("There was an error in getting the rooms.")
                console.log(err.message)

            } else {

                if ( room_res.rowCount === 0 ) {

                    //Should not trigger this case
                    console.log("There are no rooms.")

                } else {

                    //Get all the pt sessions
                    let bookings = []
                
                    let pt_session_added = false
                    let class_added = false

                    for ( let i = 0; i < room_res.rowCount; i++ ) {

                        pt_session_added = false
                        class_added = false

                        let query_get_room_pt_sessions = "SELECT room_id, pt_date, start_time, end_time FROM pt_sessions WHERE room_id='" + room_res.rows[i].room_id + "';"

                        client.query(query_get_room_pt_sessions, (err, res) => {

                            if ( err ) {

                                console.log("Error getting PT Sessions.")
                                console.log(err.message)

                            } else {

                                if ( res.rowCount === 0 ) {

                                    if ( i === room_res.rowCount - 1 ) {

                                        if ( class_added === true ) {

                                            pt_session_added = false

                                            response.send( { 'room_bookings': bookings } )

                                        } else {

                                            pt_session_added = true

                                        }

                                    }

                                } else {

                                    for ( let j = 0; j < res.rowCount; j++ ) {

                                        let date = new Date(res.rows[j].pt_date)

                                        res.rows[j].pt_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                                    }

                                    pt_session_added = true
                                    bookings = bookings.concat(res.rows)

                                    if ( i === room_res.rowCount - 1 ) {

                                        if ( class_added === true ) {

                                            pt_session_added = false

                                            response.send( { 'room_bookings': bookings } )

                                        }

                                    }

                                }

                            }

                        })

                        let query_get_room_classes = "SELECT room_id, class_date, start_time, end_time FROM classes WHERE room_id='" + room_res.rows[i].room_id + "';"

                        client.query( query_get_room_classes, (err, res) => {

                            if ( err ) {

                                console.log("There was an error in getting the classes.")
                                console.log(err.message)

                            } else {

                                if ( res.rowCount === 0 ) {

                                    if ( i === room_res.rowCount - 1 ) {

                                        if ( pt_session_added === true ) {

                                            class_added = false

                                            response.send( { 'room_bookings': bookings } )

                                        } else {

                                            class_added = true

                                        }

                                    }

                                } else {

                                    for ( let j = 0; j < res.rowCount; j++ ) {

                                        let date = new Date(res.rows[j].class_date)

                                        res.rows[j].class_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                                    }

                                    class_added = true
                                    bookings = bookings.concat(res.rows)

                                    if ( i === room_res.rowCount - 1 ) {

                                        if ( pt_session_added === true ) {

                                            class_added = false

                                            response.send( {'room_bookings': bookings} )

                                        }

                                    }

                                }

                            }

                        })

                    }

                }

            }

        })

    }

})

app.get(__dirname + '/html/view_room_bookings.html', (request, response) => {

    if ( admins.has(request.session.id) === true ) {

        response.sendFile(__dirname + '/html/view_room_bookings.html')

    } else {

        response.sendFile(__dirname + '/html/admin_login.html')

    }

})

app.get('/request_pt_sessions_page', (request, response) => {

    if ( admins.has(request.session.id) === true ) {

        response.send( { 'file_name': __dirname + '/html/view_pt_sessions.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    }

})

app.get(__dirname + '/html/view_pt_sessions.html', (request, response) => {

    if ( admins.has(request.session.id) === true ) {

        response.sendFile(__dirname + '/html/view_pt_sessions.html')

    } else {

        response.sendFile(__dirname + '/html/admin_login.html')

    }

})

app.get('/request_pt_sessions', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let query_pt_sessions = "SELECT session_id, room_id, trainer_id, member_id, pt_date, start_time, end_time FROM pt_sessions;"

        client.query(query_pt_sessions, (err, res) => {

            if ( err ) {

                console.log("There was an error in obtaining pt sessions.")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) {


                    response.send( { 'sessions': res.rows } )

                } else {

                    for ( let i = 0; i < res.rowCount; i++ ) {

                        let query_trainer_name = "SELECT first_name, last_name FROM trainers WHERE trainer_id='" + res.rows[i].trainer_id + "';"

                        let date = new Date(res.rows[i].pt_date)

                        res.rows[i].pt_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )


                        client.query(query_trainer_name, (err, result) => {

                            if ( err ) {

                                console.log("There was an error in querying the trainer's name.")
                                console.log(err.message)

                            } else {

                                if ( result.rowCount === 0 ) {

                                    console.log("There is no trainer with such name.")

                                } else {

                                    res.rows[i].trainer_name = result.rows[0].first_name + " " + result.rows[0].last_name

                                }

                                if ( i === res.rowCount - 1 ) {

                                    response.send( { 'sessions': res.rows } )

                                }

                            }

                        })

                    }

                }

            }

        })

    }

})

app.get('/request_classes_page', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let file_name = { 'file_name': __dirname + '/html/view_classes.html' }

        response.send(file_name)

    }
})

app.get(__dirname + '/html/view_classes.html', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/admin_login.html')

    } else {

        response.sendFile(__dirname + '/html/view_classes.html')

    }

})

app.get('/get_pt_cancellation_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let file_name = { 'file_name':__dirname + '/html/cancel_pt_session.html' }
        response.send(file_name)

    }

})

app.get(__dirname + '/html/cancel_pt_session.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/cancel_pt_session.html')

    }

})

app.get('/request_trainer_availability_page', (request, response) => {

    if ( admins.has( request.session.id ) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/view_trainers_availability.html'})

    }

})


app.get('/get_trainer_schedule_page', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html'} )

    } else {

        response.send( { 'file_name': __dirname + '/html/trainer_schedule_page.html'} )

    }

})

app.get(__dirname + '/html/trainer_schedule_page.html', (request, response) => {

    if ( trainers.get(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/trainer_login.html')

    } else {

        response.sendFile(__dirname + '/html/trainer_schedule_page.html')

    }

})


app.get('/get_trainer_schedule', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( {'file_name': __dirname + '/html/trainer_login.html' } )

    } else {

        let trainer_id = trainers.get(request.session.id)

        let query_trainer_class_schedule = "SELECT start_time, end_time, class_date FROM classes WHERE trainer_id='" + trainer_id + "';"

        client.query(query_trainer_class_schedule, (err, class_res) => {

            if ( err ) {

                console.log("There was an error in querying the trainer's class schedule.")
                console.log(err.message)

            } else {

                for ( let i = 0; i < class_res.rowCount; i++ ) {

                    let date = new Date(class_res.rows[i].class_date)

                    class_res.rows[i].class_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                }

                let query_trainer_pt_schedule = "SELECT start_time, end_time, pt_date FROM pt_sessions WHERE trainer_id='" + trainer_id + "';"

                client.query(query_trainer_pt_schedule, (err, pt_res) => {

                    if ( err ) {

                        console.log("There was an error in querying the trainer's pt schedule.")
                        console.log(err.message)

                    } else {

                        for ( let i = 0; i < pt_res.rowCount; i++ ) {

                            let date = new Date(pt_res.rows[i].pt_date)

                            pt_res.rows[i].pt_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                        }

                        response.send( {'schedule': pt_res.rows.concat(class_res.rows)} )

                    }

                })

            }

        })

    }

})

app.get(__dirname + '/html/view_trainers_availability.html', (request, response) => {

    if ( admins.has( request.session.id) === false ) {

        response.sendFile( __dirname + '/html/admin_login.html' )

    } else {

        response.sendFile(__dirname + '/html/view_trainers_availability.html')

    }

})

app.get('/request_trainers_schedule', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let query_trainers = "SELECT trainer_id, first_name, last_name FROM trainers;"

        let trainer_schedule = []

        client.query( query_trainers, (err, result) => {

            if ( err ) {

                console.log("There was an error querying the trainers.")
                console.log(err.message)

            } else {

                if ( result.rowCount === 0 ) {

                    console.log("There are no trainers.")

                }


                for ( let i = 0; i < result.rowCount; i++ ) {

                    let query_trainers_pt_sessions = "SELECT pt_date, start_time, end_time FROM pt_sessions WHERE trainer_id='" + result.rows[i].trainer_id + "';"

                    client.query(query_trainers_pt_sessions, (err, trainer_pt_sessions) => {

                        if ( err ) {

                            console.log("Error in querying trainers personal training sessions.")
                            console.log(err.message)

                        } else {

                            let query_trainers_classes = "SELECT class_date, start_time, end_time FROM classes WHERE trainer_id='" + result.rows[i].trainer_id + "';"

                            client.query(query_trainers_classes, (err, trainer_classes) => {

                                if ( err ) {

                                    console.log("There was an error in querying the trainers classes.")
                                    console.log(err.message)

                                } else {

                                    for ( let j = 0; j < trainer_classes.rowCount; j++ ){

                                        let date = new Date(trainer_classes.rows[j].class_date)

                                        trainer_classes.rows[j].class_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                                    }

                                    for ( let j = 0; j < trainer_pt_sessions.rowCount; j++ ){

                                        let date = new Date(trainer_pt_sessions.rows[j].pt_date)

                                        trainer_pt_sessions.rows[j].pt_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                                    }


                                    let trainer_sched = {
                                        'trainer_id': result.rows[i].trainer_id,
                                        'trainer_name': result.rows[i].first_name + " " + result.rows[i].last_name,
                                        'appt': trainer_pt_sessions.rows.concat(trainer_classes.rows)
                                    }

                                    trainer_schedule.push(trainer_sched)

                                    if ( i === result.rowCount - 1 ) {

                                        response.send( { 'appts': trainer_schedule } )

                                    }

                                }

                            })

                        }

                    })

                }

            }
        })

    }

})

app.get('/request_rooms', (request, response) => {

    if ( admins.has( request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let query = "SELECT * FROM rooms;" //Get the rooms with their bookings

        let room_bookings = []

        client.query(query, (error, result) => {

            if ( error ) {

                console.log("There was an error in querying the rooms.")
                console.log(error.message)

            } else {

                if ( result.rowCount === 0 ) {

                    console.log("There are no rooms in the database.")

                }

                for ( let i = 0; i < result.rowCount; i++ ) {


                    let room_id = result.rows[i].room_id

                    let query_room_class_schedule = "SELECT class_date, start_time, end_time FROM classes WHERE room_id='" + room_id + "';"

                    client.query ( query_room_class_schedule, (err, res_classes) => {

                        if ( err ) {

                            console.log(err.message)

                        } else {


                            let query_room_pt_schedule = "SELECT pt_date, start_time, end_time FROM pt_sessions WHERE room_id='" + room_id + "';"

                            client.query(query_room_pt_schedule, (err, res_pt_sess) => {

                                if ( err ) {

                                    console.log("There was an error in querying the PT sessions.")
                                    console.log(err.message)

                                } else {

                                    for ( let j = 0; j < res_pt_sess.rowCount; j++ ) {

                                        let date = new Date(res_pt_sess.rows[j].pt_date)

                                        res_pt_sess.rows[j].pt_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                                    }

                                    for ( let j = 0; j < res_classes.rowCount; j++ ) {

                                        let date = new Date(res_classes.rows[j].class_date)

                                        res_classes.rows[j].class_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                                    }


                                    let room_sched = {
                                        'room_id': room_id,
                                        'bookings' : res_pt_sess.rows.concat(res_classes.rows)
                                    }

                                    room_bookings.push(room_sched)

                                    if ( i === (result.rowCount - 1) ) {

                                        response.send( { 'room_bookings': room_bookings } )

                                    }

                                }
                            })

                        }

                    } )

                }

            }

        })

    }

})

app.get('/request_create_class_page', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/create_class.html' } )
    }
})


app.get(__dirname + '/html/create_class.html', (request,response) => {

    if ( admins.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/admin_login.html')

    } else {

        response.sendFile(__dirname + '/html/create_class.html')

    }

 })

app.get('/request_classes', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let query = "SELECT  class_id, room_id, class_date, start_time, end_time, class_focus, trainer_id FROM classes;"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("There was an error in retrieving the classes.")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) {

                    response.send( {'classes': []} )

                } else {

                    for ( let i = 0; i < res.rowCount; i++ ) {

                        let date = new Date(res.rows[i].class_date)

                        res.rows[i].class_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]) )

                        let query_trainer_name = "SELECT first_name, last_name FROM trainers WHERE trainer_id='" + res.rows[i].trainer_id + "';"

                        client.query(query_trainer_name, (err, result) => {

                            if ( err ) {

                                console.log("There was an error in querying the trainer name.")
                                console.log(err.message)

                            } else {

                                if ( result.rowCount === 0 ) {

                                    console.log("There are no trainers with the given ID.")

                                } else {

                                    res.rows[i].trainer_name = result.rows[0].first_name + " " + result.rows[0].last_name

                                    if ( i === res.rowCount - 1 ) {

                                        response.send( {'classes': res.rows} )

                                    }

                                }

                            }

                        })

                    }

                }

            }

        })

    }

})

app.post('/record_workout', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let member_id = users.get(request.session.id)
        let workout_obj = request.body

        if ( parseInt(workout_obj.workout_length) > 0 ) {

            let save_workout_query = "INSERT INTO workouts ( member_id,"

            if ( workout_obj.workout_date.length > 0 ) { //Will let it be default if user did not specify

                save_workout_query += "workout_date,"

            }

            save_workout_query += "workout_length) VALUES ('"
            save_workout_query += member_id
            save_workout_query += "', '"

            if ( workout_obj.workout_date.length > 0 ) {

                save_workout_query += workout_obj.workout_date
                save_workout_query += "', '"

            }

            save_workout_query += workout_obj.workout_length
            save_workout_query += "' ) RETURNING workout_id;"

            client.query( save_workout_query, (err, res) => {

                if ( err ) {

                    console.log("There was an error in adding the data to the table.")
                    console.log(err.message)
                    response.send( { 'workout_saved': false } )

                } else {

                    if ( res.rowCount === 0 ) {

                        console.log("Row Count is zero.")
                        response.send( { 'workout_saved': false } )

                    } else {

                        let workout_id = res.rows[0].workout_id
                        let valid_note_exists = false

                        for ( let i = 0 ; i < workout_obj.workout_notes.length; i++ ) {

                            let workout_note = workout_obj.workout_notes[i]

                            if ( workout_note.machine_id !== '' ) {

                                valid_note_exists = true

                                let add_workout_note_query = "INSERT INTO machines_used( equipment_name, workout_id, notes ) VALUES ('"

                                add_workout_note_query += workout_note.machine_id
                                add_workout_note_query += "', '"
                                add_workout_note_query += workout_id
                                add_workout_note_query += "', '"
                                add_workout_note_query += workout_note.notes
                                add_workout_note_query += "');"

                                client.query( add_workout_note_query, (err, res) => {

                                    if ( err ) {

                                        console.log("There was an error in adding the workout notes.")
                                        console.log(err.message)
                                        response.send( { 'workout_saved': false } )

                                    } else {

                                        if ( i === workout_obj.workout_notes.length - 1 ) {

                                            console.log("Workout notes added successfully. Please check database.")
                                            response.send( { 'workout_saved': true } )

                                        }

                                    }

                                })

                            }

                        }

                        if ( valid_note_exists === false ) {

                            response.send( { 'workout_saved': true } )

                        }

                    }

                }

            })

        } else {

            response.send( { 'workout_saved': false } )

        }

    }

})

app.post('/create_class', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let class_obj = request.body


        //Need to check if room booked during that time
        //Need to check if trainer has a PT session or class at that time

        let query_room_bookings = "SELECT class_id FROM classes WHERE class_date='" + class_obj.class_date + "' AND start_time<='" + class_obj.start_time + "' AND end_time>='" + class_obj.end_time + "'"
        query_room_bookings += " AND room_id='" + class_obj.room_id + "';"

        client.query(query_room_bookings, (err, res) => {

            if ( err ) {

                console.log("There was an error in querying the classes bookings.")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) { //No classes booking room at that time

                    let query_pt_sessions = "SELECT session_id FROM pt_sessions WHERE room_id='" + class_obj.room_id + "' AND pt_date='" + class_obj.class_date + "' AND start_time>='" + class_obj.start_time + "' AND end_time<='" + class_obj.end_time + "';"

                    client.query(query_pt_sessions, (err, res) => {

                        if ( err ) {

                            console.log("There was an error in querying the pt sessions.")
                            console.log(err.message)

                        } else {

                            if ( res.rowCount === 0 ) { //No classes and pt sessions taking up that room at that time

                                //Check if trainer has a class at that time
                                let query_trainer_class_schedule = "SELECT class_id FROM classes WHERE trainer_id='" + class_obj.trainer_id + "' AND class_date='" + class_obj.class_date + "' AND start_time<='" + class_obj.start_time + "' AND end_time>='" + class_obj.end_time + "';"

                                client.query(query_trainer_class_schedule, (err,res) => {

                                    if ( err ) { 

                                        console.log("Error in querying the trainer's class schedule.")
                                        console.log(err.message)
                                    } else {

                                        if ( res.rowCount === 0 ) { //Trainer does not have a class at that time

                                            let query_trainer_pt_schedule = "SELECT session_id FROM pt_sessions WHERE trainer_id='" + class_obj.trainer_id + "' AND pt_date='" + class_obj.class_date + "' AND start_time<='" + class_obj.start_time + "' AND end_time>='" + class_obj.end_time + "';"

                                            client.query(query_trainer_pt_schedule, (err, res) => {

                                                if ( err ) {

                                                    console.log("Error in querying the trainer's pt schedule.")
                                                    console.log(err.message)

                                                } else {

                                                    if ( res.rowCount === 0 ) { //Everything checks out book the class

                                                        let add_class_query = "INSERT INTO classes (trainer_id, room_id, class_date"
                                                        add_class_query += ", start_time, end_time, class_focus) VALUES ('" + class_obj.trainer_id
                                                        add_class_query +=  "', '" + class_obj.room_id + "', '" + class_obj.class_date + "', '"
                                                        add_class_query += class_obj.start_time + "', '" + class_obj.end_time + "', '" + class_obj.class_focus + "') ;"

                                                        console.log(add_class_query)
                                                        client.query(add_class_query, (err, res) => {

                                                            if ( err ) {

                                                                console.log("There was an error in adding the class.")
                                                                console.log(err.message)
                                                                response.send( { 'booked': false } )

                                                            } else {


                                                                response.send( { 'booked': true } )
                                                                console.log("Added class successfully! Check database.")

                                                            }

                                                        })

                                                    } else {

                                                        response.send( { 'booked': false } )
                                                        console.log("Trainer has PT Session booked at that time.")

                                                    }

                                                }

                                            })

                                        } else {

                                            response.send( { 'booked': false } )
                                            console.log("Trainer has class booked at that time.")

                                        }

                                    }

                                })

                            } else {

                                response.send( { 'booked': false } )
                                console.log("There is a PT session booked for that room at that time.")

                            }

                        }

                    })

                } else {

                    response.send( { 'booked': false } )
                    console.log("There is a class session booked for that room at that time.")

                }

            }

        })

    }

})


app.post('/reschedule_class', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {


        let reschedule_obj = request.body

        let query_users_taking_class = "SELECT member_id FROM users_taking_class WHERE class_id='" + reschedule_obj.class_id + "';"

        client.query(query_users_taking_class, (err, res) => {

            if ( err ) {

                console.log("There was an error in querying the classes.")
                console.log(err.message)
                response.send( { 'changed': false } )

            } else {


                if ( res.rowCount === 0 ) {

                    let update_class_schedule_query = "UPDATE classes SET start_time='" + reschedule_obj.start_time + "', end_time='" + reschedule_obj.end_time + "', class_date='" + reschedule_obj.class_date
                    update_class_schedule_query += "' WHERE class_id='" + reschedule_obj.class_id + "';"

                    client.query(update_class_schedule_query, (err, res) => {

                        if ( err ) {


                            console.log("There was an issue in updating the class schedule.")
                            console.log(err.message)
                            response.send( { 'changed': false } )

                        } else {

                            response.send( { 'changed': true } )
                        }

                    })


                } else {

                    //Users already might be taking this class - Can't change -> Might have overlapping classes/pt sessions.
                    response.send( { 'changed': false} )

                }

            }
        })

    }

})

app.post('/delete_class', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let class_to_delete = request.body

        let query = "DELETE FROM classes WHERE class_id='" + class_to_delete.class_id + "';"
        let query_users_taking_class = "SELECT member_id FROM users_taking_class WHERE class_id='" + class_to_delete.class_id + "';"

        client.query( query_users_taking_class, (err, users_taking_classes) => {

            if ( err ) {

                console.log("There was an error in querying the members that are taking this class.")
                console.log(err.message)

            } else {

                if ( users_taking_classes.rowCount === 0 ) {

                    client.query(query, (err, res) => {

                        if ( err ) {

                            console.log("There was an error in deleting the class.")
                            console.log(err.message)
                            response.send( { 'deleted': false } )

                        } else {

                            console.log("The class was deleted successfully. Check DB for updates.")
                            response.send( { 'deleted': true } )

                        }

                    })

                } else {

                    for ( let i = 0; i < users_taking_classes.rowCount; i++ ) {

                        let get_user_funds_query = "SELECT funds from members WHERE user_name='" + users_taking_classes.rows[i].member_id  + "';"

                        client.query(get_user_funds_query, ( err, res ) => {

                            if ( err ) {

                                console.log("There was an error in getting the user's funds from the table.")
                                console.log(err.message)

                            } else {

                                let funds = res.rows[0].funds

                                funds += 5

                                let update_users_funds = "UPDATE members SET funds='" + funds + "' WHERE user_name='" + users_taking_classes.rows[i].member_id + "';"

                                client.query(update_users_funds, (err, res) => {

                                    if ( err ) {

                                        console.log("There was an error in updating the users funds.")
                                        console.log(err.message)

                                    } else {

                                        if ( i === users_taking_classes.rowCount - 1 ) {

                                            client.query(query, (err, res) => {

                                                if ( err ) {

                                                    console.log("There was an error in deleting the class.")
                                                    console.log(err.message)
                                                    response.send( { 'deleted': false } )

                                                } else {

                                                    console.log("The class was deleted successfully. Check DB for updates.")
                                                    response.send( { 'deleted': true } )

                                                }

                                            })

                                        }

                                    }

                                })

                            }

                        })

                    }

                }

            }

        })

    }

})

app.post('/cancel_pt_session', (request, response) => {

    if ( (users.has(request.session.id) === false) && (admins.has(request.session.id) === false) ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let pt_obj = request.body
        let user_name = users.get(request.session.id)
        let query_users_funds = "SELECT points, funds FROM members WHERE user_name='" + user_name + "';"

        client.query(query_users_funds, (err, res) => {

            if ( err ) {

                console.log("There was an error in querying the user's funds.")
                console.log(err.message)

            } else {

                let funds = res.rows[0].funds
                let points = res.rows[0].points
                //To Stop Infinite point glitch
                if ( points < 10 ) {

                    if ( points >= 5 ) {

                        points -= 5
                        funds += 9

                    } else {

                        allow_refund = false
                    }


                } else {

                    funds += 10
                    points -= 10

                }

                let query_update_users_funds = "UPDATE members SET funds='" + funds + "', points='" + points + "' WHERE user_name='" + user_name + "';"

                client.query(query_update_users_funds, (err, res) => {

                    if ( err ) {

                        console.log("There was an error in updating the user's funds.")
                        console.log(err.message)

                    } else {


                        let query = "DELETE FROM pt_sessions WHERE session_id='" + pt_obj.session_id + "';"

                        client.query(query, (err, res) => {

                            if ( err ) {

                                console.log("There was an error in deleting the personal training session.")
                                console.log(err.message)
                                response.send( { 'deleted': false } )

                            } else {

                                console.log("The personal training session deleted successfully check table.")

                                let add_refund_to_transaction_table = "INSERT INTO transactions (user_name, amount, description) VALUES ('" + user_name + "', '-10', 'User Cancelled PT Session');"

                                client.query(add_refund_to_transaction_table, (err, res) => {

                                    if ( err ) {

                                        console.log("There was an error in adding the cancelling of a personal training session to the transaction table.")
                                        console.log(err.message)

                                    } else {

                                        console.log("Successfully added the cancellation of the personal training session to the table.")

                                    }
                                })
                                response.send( { 'deleted': true } )

                            }

                        })

                    }

                })

            }

        })

    }

})

app.get('/get_pt_sessions', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)
        let query = "SELECT session_id, trainer_id, pt_date, start_time, end_time FROM pt_sessions WHERE member_id='" + user_name + "';"

        client.query( query, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the member's schedule.")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) {

                    response.send( { 'pt_sessions': res.rows } )

                } else {

                    for ( let i = 0; i < res.rowCount; i++ ) {

                        let query_trainer_name = "SELECT first_name, last_name FROM trainers WHERE trainer_id='" + res.rows[i].trainer_id + "';"

                        client.query(query_trainer_name, (err, result) => {

                            if ( err ) {

                                console.log("There was an error in querying the trainer name.")
                                console.log(err.message)

                            } else {

                                if ( result.rowCount === 0 ) {

                                    console.log("Could not find a trainer with the given ID.")

                                } else {

                                    res.rows[i].trainer_name = result.rows[0].first_name + " " + result.rows[0].last_name

                                }

                                if ( i === res.rowCount - 1 ) {

                                    response.send( {'pt_sessions': res.rows} )

                                }


                            }

                        })

                    }

                }
            }
        })

    }

})

app.get('/get_past_pt_sessions', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html' } )

    } else {

        let trainer_id = trainers.get(request.session.id)

        let query = "SELECT session_id, member_id, pt_date, start_time, end_time FROM pt_sessions s WHERE s.trainer_id='" + trainer_id + "' AND NOT EXISTS ("
        query += " SELECT 1 FROM pt_notes p WHERE p.session_id=s.session_id);"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("There was an error in searching this query")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) {

                    response.send( {'no_sessions': true} )

                } else {

                    let pt_sessions = res.rows

                    //Format all the dates so the client just has to print them
                    //Convert all dates to useable format
                    for ( let i = 0; i < pt_sessions.length; i++ ) {

                        let date = new Date(pt_sessions[i].pt_date)

                        pt_sessions[i].pt_date = utilities.formatDateDMY(date.toISOString().split('T')[0])

                    }

                    response.send( {'pt_sessions': pt_sessions } )

                }

            }

        })

    }
})

app.get(__dirname + '/html/trainer_login.html', (request, response) => {

    response.sendFile(__dirname + '/html/trainer_login.html')

})

app.get('/get_past_pt_sessions_page', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html' } )

    } else {

        response.send( {'file_name' : __dirname + '/html/past_pt_sessions_page.html'} )

    }

})

app.get('/get_members_page', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html' } )

    } else {

        response.send( {'file_name' : __dirname + '/html/display_members_page.html' } )

    }

})

app.get('/get_equipments_page', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html' } )

    } else {

        response.send( {'file_name': __dirname + '/html/request_equipment_maintenance_page.html' } )

    }

})

app.get(__dirname + '/html/request_equipment_maintenance_page.html', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/trainer_login.html')

    } else {

        response.sendFile(__dirname + '/html/request_equipment_maintenance_page.html')

    }

})

app.get('/request_equipment_list', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html' } )

    } else {

        let query = "SELECT * FROM equipment;"

        client.query( query, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the equipment list.")
                console.log(err.message)

            } else {

                response.send( { 'equipment': res.rows } )

            }

        })

    }

})

app.get(__dirname + '/html/display_members_page.html', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/trainer_login.html')

    } else {

        response.sendFile(__dirname + '/html/display_members_page.html')

    }

})

app.get('/get_members_list', (request, response) => {

    if ( (trainers.has(request.session.id) === false) && (admins.has(request.session.id) === false) ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html'} )

    } else {

        let query = "SELECT user_name FROM members;"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("Unable to get Members.")
                console.log(err.message)

            } else {

                response.send( { 'members': res.rows } )

            }

        })

    }

})

app.get('/request_member_info', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html'} )

    } else {

        let user_name = request.query.user_name
        let query = "SELECT user_name, email, birth_day, first_name, last_name FROM members WHERE user_name='" + user_name + "';"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("Error getting user information")
                console.log(err.message)

            } else {

                let user = res.rows
                let birth_day = new Date(user[0].birth_day)
                user[0].birth_day = utilities.formatDateDMY(birth_day.toISOString().split('T')[0].toString())
                response.send( {'user_info': user[0] } )

            }

        })

    }

})

app.get('/get_scheduling_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html'} )

    } else {

        let file_name = { 'file_name': __dirname + '/html/scheduling_page.html'}

        response.send(file_name)

    }

})

app.get(__dirname + '/html/scheduling_page.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/scheduling_page.html')

    }

})

app.get('/request_user_schedule', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name' :__dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let query = "SELECT * FROM pt_sessions WHERE member_id='" + user_name + "';"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("Error in getting appt information.")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) {

                    response.send( { 'schedule': res.rows } )

                } else {

                    let pt_sessions = res.rows

                    for ( let i = 0; i < pt_sessions.length; i++ ) {

                        let date = new Date(pt_sessions[i].pt_date)

                        pt_sessions[i].pt_date = utilities.formatDateDMY(date.toISOString().split('T')[0])
                        let query_trainer_name = "SELECT first_name, last_name FROM trainers t WHERE t.trainer_id='" + pt_sessions[i].trainer_id + "';"

                        client.query( query_trainer_name, (err, res) => {

                            if ( err ) {

                                console.log("Error finding trainer with the given ID.")
                                console.log(err.message)

                            } else {

                                if ( res.rowCount !== 0 ) {

                                    pt_sessions[i].first_name = res.rows[0].first_name
                                    pt_sessions[i].last_name  = res.rows[0].last_name

                                }

                                if ( i === (pt_sessions.length - 1) ) {

                                    response.send( { 'schedule': pt_sessions } )

                                }

                            }

                        })

                    }

                }
            }

        })

    }

})

app.get('/book_classes', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name' :__dirname + '/html/user_login.html' } )

    } else {

        let file_name = { 'file_name': __dirname + '/html/book_classes_page.html'}
        response.send(file_name)

    }

})


app.get('/request_refund_page', (request,response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/refund_payment_fee.html' } )

    }

})

app.get(__dirname + '/html/refund_payment_fee.html', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.sendFile( __dirname + '/html/admin_login.html' )

    } else {

        response.sendFile( __dirname + '/html/refund_payment_fee.html' )

    }

})

app.post('/refund_user', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let user_name = request.body.user_name

        let verify_refund_query = "SELECT payment_date, funds FROM members WHERE user_name='" + user_name + "';"


        client.query(verify_refund_query, (err, res_payment_date) => {

            if ( err ) {

                console.log("There was an error in querying the user's payment date.")
                console.log(err.message)
                response.send( { 'refund_successful': false } )

            } else {

                let query_current_date = "SELECT CURRENT_DATE;"

                if ( res_payment_date.rowCount === 1 ) {

                    let user_funds = res_payment_date.rows[0].funds

                    client.query(query_current_date, (err, cur_date_res) => {

                        if ( err ) {

                            console.log("There was an error in querying the current date.")
                            console.log(err.message)
                            response.send( { 'refund_successful': false } )

                        } else {

                            if ( cur_date_res.rowCount === 1 ) {

                                let curr_date = new Date(cur_date_res.rows[0].current_date)
                                let date = new Date(res_payment_date.rows[0].payment_date)
                                let payment_date = utilities.formatDateYMDObj( date.toISOString().split('T')[0] )


                                curr_date = utilities.formatDateYMDObj ( curr_date.toISOString().split('T')[0] )

                                if ( utilities.dateLess(curr_date, payment_date) === true ) {

                                    user_funds += 15

                                    payment_date.month -= 1

                                    if ( payment_date.month <= 0 ) {

                                        payment_date.month = 12
                                        payment_date.year -= 1

                                    }

                                    payment_date = utilities.convertDateToStringYMD(payment_date)
                                    let query_refund_user = "UPDATE members SET funds='" + user_funds + "', payment_date='" + payment_date + "' WHERE user_name='" + user_name + "';"

                                    client.query(query_refund_user, (err, res) => {

                                        if ( err ) {

                                            console.log("There was an error in refunding the client.")
                                            console.log(err.message)
                                            response.send( { 'refund_successful': false } )

                                        } else {

                                            let update_transactions_table = "INSERT INTO transactions (user_name, amount, description) VALUES ('" + user_name + "', '-15', 'Admin refunded monthly fee');"

                                            client.query(update_transactions_table, (err, res) => {

                                                if ( err ) {

                                                    console.log("There was an error in updating the transaction table.")
                                                    console.log(err.message)

                                                }

                                            })

                                            response.send( { 'refund_successful': true } )

                                        }

                                    })

                                } else {

                                    response.send( { 'refund_successful': false } )

                                }

                            } else {

                                response.send( { 'refund_successful': false } )

                            }

                        }

                    })

                } else {

                    response.send( { 'refund_successful': false } )

                }

            }

        })

    }

})



app.get(__dirname + '/html/past_pt_sessions_page.html', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/trainer_login.html')

    } else {

        response.sendFile(__dirname + '/html/past_pt_sessions_page.html')

    }

})

app.get(__dirname + '/html/book_classes_page.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/book_classes_page.html')

    }

})

app.get('/classes', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let query = "SELECT * FROM classes;"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the classes")
                console.log(err.message)

            } else {

                for ( let i = 0; i < res.rowCount; i++ ) {

                    let new_date = new Date(res.rows[i].class_date)
                    res.rows[i].class_date = utilities.formatDateDMY(new_date.toISOString().split('T')[0].toString())

                }

                response.send( { 'classes' : res.rows } )

            }

        })

    }

})

app.get('/book_pt_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name' : __dirname + '/html/user_login.html'} )

    } else {

        let file_name = { 'file_name' : __dirname + '/html/book_pt_session.html'}
        response.send(file_name)

    }

})

app.get(__dirname + '/html/book_pt_session.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/book_pt_session.html')

    }

})

app.get(__dirname + '/html/home_page.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/home_page.html')

    }

})

app.get(__dirname + '/html/sign_up_page.html', (request, response) => {

    response.sendFile(__dirname + '/html/sign_up_page.html')

})

app.get(__dirname + '/html/trainer_home_page.html', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/trainer_login.html')

    } else {

        response.sendFile(__dirname + '/html/trainer_home_page.html')

    }

})

app.get('/get_rooms', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html'} )

    } else {

        let query_room_ids = "SELECT room_id FROM rooms;"

        client.query( query_room_ids, (err, rooms) => {

            if ( err ) {

                console.log("There was an error in querying the room ids.")
                console.log(err.message)

            } else {

                appointments = []
                for ( let j = 0; j < rooms.rowCount; j++ ) {

                    let query_room_pt_session = "SELECT pt_date, start_time, end_time FROM pt_sessions WHERE room_id='" + rooms.rows[j].room_id + "' ORDER BY pt_date, start_time;"

                    client.query(query_room_pt_session, (err, pt_classes) => {

                        if ( err ) {

                            console.log("There was an error in querying the personal training sessions.")
                            console.log(err.message)

                        } else {

                            for ( let i = 0 ; i < pt_classes.rowCount; i++ ) {

                                let date = new Date(pt_classes.rows[i].pt_date)

                                pt_classes.rows[i].pt_date = date.toISOString().split('T')[0]

                            }

                            let query_room_classes = "SELECT class_date, start_time, end_time FROM classes WHERE room_id='" + rooms.rows[j].room_id + "' ORDER BY class_date, start_time;"

                            client.query( query_room_classes, (err, classes) => {

                                if ( err ) {

                                    console.log("There was an error in querying the classes.")
                                    console.log(err.message)

                                } else {

                                    for ( let i = 0 ; i < classes.rowCount; i++ ) {

                                        let date = new Date(classes.rows[i].class_date)

                                        classes.rows[i].class_date = date.toISOString().split('T')[0]

                                    }

                                    let appointment_obj = {

                                        'room_id': rooms.rows[j].room_id,
                                        'appointments': classes.rows.concat(pt_classes.rows)

                                    }

                                    appointments.push(appointment_obj)

                                    if ( j === rooms.rowCount - 1 ) {

                                        response.send( { 'appointments': appointments } )

                                    }

                                }
                            })
                        }
                    })
                }

            }

        })

    }

})

app.get('/trainers_schedule', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html'} )

    } else {

        let trainer_id = request.query.trainer_id

        let query_trianer_pt_schedule = "SELECT pt_date, start_time, end_time FROM pt_sessions WHERE trainer_id='" + trainer_id + "';"

        client.query( query_trianer_pt_schedule, (err, pt_appts) => {

            if ( err ) {

                console.log("There was an error in querying the trainer's schedule.")
                console.log(err.message)

            } else {

                for ( let i = 0; i < pt_appts.rowCount; i++ ) {

                    let date = new Date(pt_appts.rows[i].pt_date)

                    pt_appts.rows[i].pt_date = date.toISOString().split('T')[0]

                }


                let trainer_schedule = pt_appts.rows
                let query_trainer_class_schedule = "SELECT class_date, start_time, end_time FROM classes WHERE trainer_id='" + trainer_id + "';"

                client.query(query_trainer_class_schedule, (err, classes_appts) => {

                    if ( err ) {

                        console.log("There was an error in querying the classes.")
                        console.log(err.message)

                    } else {

                        for ( let i = 0; i < classes_appts.rowCount; i++ ) {

                            let date = new Date(classes_appts.rows[i].class_date)

                            classes_appts.rows[i].class_date = date.toISOString().split('T')[0]

                        }

                        trainer_schedule = trainer_schedule.concat(classes_appts.rows)

                        response.send( { 'trainer_schedule': trainer_schedule } )

                    }

                })

            }

        })

    }

})

app.get('/trainers', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let query = "SELECT trainer_id, first_name, last_name FROM trainers;"

        client.query(query, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the trainers")
                console.log(err.message)

            } else {

                let trainers = { 'trainers' : res.rows }
                response.send(trainers)

            }

        })


    }

})

app.post('/book_pt_session', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let pt_obj = request.body.pt_session_obj

        if ( (pt_obj.pt_date === '') || (pt_obj.start_time === '') || (pt_obj.end_time === '') ) {

            response.send( { 'booked': false } )

        } else if ( pt_obj.start_time >= pt_obj.end_time ) {

            response.send( { 'booked': false } )

        } else {

            let user_name = users.get(request.session.id)

            let query_room_pt_schedule = "SELECT pt_date, start_time, end_time FROM pt_sessions WHERE room_id='" + pt_obj.room_id + "' AND (( '"
            query_room_pt_schedule += pt_obj.start_time  + "'>=start_time AND '" + pt_obj.start_time + "'<=end_time) OR ('" + pt_obj.end_time + "'>=start_time AND '" + pt_obj.end_time + "'<=end_time)) AND pt_date='" + pt_obj.pt_date + "';"

            client.query(query_room_pt_schedule, (err, res) => {

                if ( err ) {

                    console.log("There was an error in querying the pt schedules.")
                    console.log(err.message)

                } else {

                    if ( res.rowCount === 0 ) {

                        let query_room_class_schedule = "SELECT class_date, start_time, end_time FROM classes WHERE room_id='" + pt_obj.room_id 
                        query_room_class_schedule += "' AND (('" + pt_obj.start_time + "'>=start_time AND '"+ pt_obj.start_time + "'<=end_time) OR ('" + pt_obj.end_time + "'>=start_time AND '" + pt_obj.end_time + "'<=end_time)) AND class_date='" + pt_obj.pt_date + "';"

                        client.query( query_room_class_schedule, (err, res) => {

                            if ( err ) {

                                console.log("There was an error in querying the class schedule.")
                                console.log(err.message)
                                response.send( { 'booked': false } )

                            } else {

                                if ( res.rowCount === 0 ) {

                                    let query_trainer_pt_schedule = "SELECT pt_date, start_time, end_time FROM pt_sessions WHERE trainer_id='" + pt_obj.trainer_id
                                    query_trainer_pt_schedule += "' AND (('" + pt_obj.start_time + "'>=start_time AND '"+ pt_obj.start_time + "'<=end_time) OR ('" + pt_obj.end_time + "'>=start_time AND '" + pt_obj.end_time + "'<=end_time)) AND pt_date='" + pt_obj.pt_date + "';"

                                    client.query(query_trainer_pt_schedule, (err, res) => {

                                        if ( err ) {

                                            console.log("There was an error in querying the trainer's schedule.")
                                            console.log(err.message)
                                            response.send( { 'booked': false } )

                                        } else {

                                            if ( res.rowCount === 0 ) {

                                                let query_trainer_class_schedule = "SELECT class_date, start_time, end_time FROM classes WHERE trainer_id='" + pt_obj.trainer_id 
                                                query_trainer_class_schedule += "' AND (('" + pt_obj.start_time + "'>=start_time AND '" + pt_obj.start_time + "'<=end_time) OR ('" + pt_obj.end_time + "'>=start_time AND '" + pt_obj.end_time + "'<=end_time)) AND class_date='" + pt_obj.pt_date + "';"

                                                client.query(query_trainer_class_schedule, (err, res) => {

                                                    if ( err ) {

                                                        console.log("There was an error in querying the trainer's class schedule.")
                                                        console.log(err.message)
                                                        response.send( { 'booked': false } )

                                                    } else {

                                                        if ( res.rowCount === 0 ) {

                                                            let query_users_pt_schedule = "SELECT pt_date, start_time, end_time FROM pt_sessions WHERE member_id='" + user_name 
                                                            query_users_pt_schedule += "' AND (('" + pt_obj.start_time + "'>=start_time AND '" + pt_obj.start_time + "'<=end_time) OR ('" + pt_obj.end_time + "'>=start_time AND '" + pt_obj.end_time + "'<=end_time)) AND pt_date='" + pt_obj.pt_date + "';"

                                                            client.query(query_users_pt_schedule, (err, res) => {

                                                                if ( err ) {

                                                                    console.log("There was an error querying the users pt schedule.")
                                                                    console.log(err.message)
                                                                    response.send( { 'booked': false } )

                                                                } else {

                                                                    if ( res.rowCount === 0 ) {

                                                                        let query_users_class_schedule = "SELECT class_id FROM users_taking_class WHERE member_id='" + user_name + "';"

                                                                        client.query( query_users_class_schedule, (err, res) => {

                                                                            if ( err ) {

                                                                                console.log("There was an error in querying the user's class schedule.")
                                                                                console.log(err.message)
                                                                                response.send( { 'booked': false } )

                                                                            } else {

                                                                                if ( res.rowCount === 0 ) {

                                                                                    let query_users_funds = "SELECT funds, points, payment_date FROM members WHERE user_name='" + user_name + "';"

                                                                                    client.query(query_users_funds, (err, funds_res) => {

                                                                                        if ( err ) {

                                                                                            console.log("There was an error in getting the user's funds.")
                                                                                            console.log(err.message)
                                                                                            response.send( { 'booked': false } )

                                                                                        } else {

                                                                                            let points = parseInt(funds_res.rows[0].points)
                                                                                            let funds = parseInt(funds_res.rows[0].funds)
                                                                                            let payment_date = funds_res.rows[0].payment_date
                                                                                            let pt_date = pt_obj.pt_date


                                                                                            payment_date = new Date(payment_date)
                                                                                            pt_date = new Date(pt_date)
                                                                                            payment_date = utilities.formatDateYMDObj(payment_date.toISOString().split('T')[0])
                                                                                            payment_date = utilities.incrementDays(payment_date, 0, 1, 0)
                                                                                            pt_date = utilities.formatDateYMDObj(pt_date.toISOString().split('T')[0])


                                                                                            if ( utilities.dateLess(pt_date, payment_date) === true ) {


                                                                                                if ( funds >= 10 ) {

                                                                                                    funds -= 10
                                                                                                    points += 10

                                                                                                    let update_users_funds = "UPDATE members SET funds='" + funds + "', points='" + points + "' WHERE user_name='" + user_name + "';"

                                                                                                    client.query(update_users_funds, (err, res) => {

                                                                                                        if ( err ) {

                                                                                                            console.log("There was an error in updating the users funds.")
                                                                                                            console.log(err.message)
                                                                                                            response.send( { 'booked': false } )

                                                                                                        } else {

                                                                                                            let query_book_pt_session = "INSERT INTO pt_sessions ( member_id, trainer_id, room_id, start_time, end_time, pt_date) VALUES ('"
                                                                                                            query_book_pt_session += user_name + "' , '" + pt_obj.trainer_id + "' , '" + pt_obj.room_id + "', '" + pt_obj.start_time
                                                                                                            query_book_pt_session += "', '" + pt_obj.end_time + "', '" + pt_obj.pt_date + "' );"

                                                                                                            client.query( query_book_pt_session, (err, res) => {

                                                                                                                if ( err ) {

                                                                                                                    console.log("There was an error in querying the personal training session.")
                                                                                                                    console.log(err.message)
                                                                                                                    response.send( { 'booked': false } )

                                                                                                                } else {

                                                                                                                    console.log("Personal training session booked.")

                                                                                                                    let query_update_transaction_table = "INSERT INTO transactions ("
                                                                                                                    query_update_transaction_table += "user_name, amount, description) VALUES ('"
                                                                                                                    query_update_transaction_table += user_name + "', '"
                                                                                                                    query_update_transaction_table += 10 + "', 'booked a personal training session');"

                                                                                                                    client.query( query_update_transaction_table, (err, res) => {

                                                                                                                        if ( err ) {

                                                                                                                            console.log("There was an error in updating the transaction table.")
                                                                                                                            console.log(err.message)

                                                                                                                        } else {

                                                                                                                            console.log("Successfully updated the transaction table.")

                                                                                                                        }

                                                                                                                    })

                                                                                                                    response.send( { 'booked': true } )

                                                                                                                }

                                                                                                            })

                                                                                                        }

                                                                                                    })

                                                                                                } else {

                                                                                                    response.send( { 'booked': false } )

                                                                                                }

                                                                                            } else {

                                                                                                response.send( { 'booked': false } )

                                                                                            }

                                                                                        }

                                                                                    })

                                                                                } else {

                                                                                    let can_book = true

                                                                                    for ( let i = 0; i < res.rowCount; i++ ) {

                                                                                        let query_class = "SELECT class_date, start_time, end_time FROM classes WHERE class_id='" + res.rows[i].class_id + "';"

                                                                                        client.query( query_class, (err, result) => {

                                                                                            if ( err ) {

                                                                                                console.log("There was an error in querying the classes.")
                                                                                                console.log(err.message)
                                                                                                response.send( { 'booked': false } )

                                                                                            } else {


                                                                                                //Checking for time overlap
                                                                                                if ( (result.rows[0].class_date === pt_obj.pt_date) && 
                                                                                                     (((pt_obj.start_time >= result.rows[0].start_time) &&
                                                                                                      (pt_obj.start_time <= result.rows[0].end_time))||
                                                                                                      ((pt_obj.end_time >= result.rows[0].start_time) &&
                                                                                                      (pt_obj.end_time <= result.rows[0].end_time)))) {

                                                                                                    can_book = false

                                                                                                }

                                                                                                if (i === res.rowCount - 1) {

                                                                                                    if ( can_book === true ) {

                                                                                                        let query_users_funds = "SELECT points, funds, payment_date FROM members WHERE user_name='" + user_name + "';"

                                                                                                        client.query(query_users_funds, (err, funds_res) => {

                                                                                                            if ( err ) {

                                                                                                                console.log("There was an error in querying the user's funds.")
                                                                                                                console.log(err.message)
                                                                                                                response.send( { 'booked': false } )

                                                                                                            } else {

                                                                                                                let points = parseInt(funds_res.rows[0].points)
                                                                                                                let funds = parseInt(funds_res.rows[0].funds)
                                                                                                                let payment_date = funds_res.rows[0].payment_date
                                                                                                                let pt_date = pt_obj.pt_date

                                                                                                                payment_date = new Date(payment_date)
                                                                                                                pt_date = new Date(pt_date)
                                                                                                                payment_date = utilities.formatDateYMDObj(payment_date.toISOString().split('T')[0])
                                                                                                                payment_date = utilities.incrementDays(payment_date, 0, 1, 0)
                                                                                                                pt_date = utilities.formatDateYMDObj(pt_date.toISOString().split('T')[0])

                                                                                                                if ( utilities.dateLess(pt_date, payment_date) === true ) {

                                                                                                                    if ( funds >= 10 ) {

                                                                                                                        funds -= 10
                                                                                                                        points += 10

                                                                                                                        let query_update_users_funds = "UPDATE members SET funds='" + funds + "', points='" + points + "' WHERE user_name='" + user_name + "';"

                                                                                                                        client.query(query_update_users_funds, (err, res) => {

                                                                                                                            if ( err ) {

                                                                                                                                console.log("There was an error updating the users funds.")
                                                                                                                                console.log(err.message)
                                                                                                                                response.send( { 'booked': false } )

                                                                                                                            } else {

                                                                                                                                let query_book_pt_session = "INSERT INTO pt_sessions ( member_id, trainer_id, room_id, start_time, end_time, pt_date) VALUES ('"
                                                                                                                                query_book_pt_session += user_name + "' , '" + pt_obj.trainer_id + "' , '" + pt_obj.room_id + "', '" + pt_obj.start_time
                                                                                                                                query_book_pt_session += "', '" + pt_obj.end_time + "', '" + pt_obj.pt_date + "' );"

                                                                                                                                client.query( query_book_pt_session, (err, res) => {

                                                                                                                                    if ( err ) {

                                                                                                                                        console.log("There was an error in querying the personal training session.")
                                                                                                                                        console.log(err.message)
                                                                                                                                        console.log("(1)")
                                                                                                                                        response.send( { 'booked': false } )

                                                                                                                                    } else {

                                                                                                                                        console.log("Personal training session booked.")

                                                                                                                                        let query_update_transaction_table = "INSERT INTO transactions ("
                                                                                                                                        query_update_transaction_table += "user_name, amount, description) VALUES ('"
                                                                                                                                        query_update_transaction_table += user_name + "', '"
                                                                                                                                        query_update_transaction_table += 10 + "', 'booked a personal training session');"

                                                                                                                                        client.query( query_update_transaction_table, (err, res) => {

                                                                                                                                            if ( err ) {

                                                                                                                                                console.log("There was an error in updating the transaction table.")
                                                                                                                                                console.log(err.message)

                                                                                                                                            } else {

                                                                                                                                                console.log("Successfully updated the transaction table.")

                                                                                                                                            }

                                                                                                                                        })

                                                                                                                                        response.send( { 'booked': true } )

                                                                                                                                    }

                                                                                                                                })

                                                                                                                            }

                                                                                                                        })

                                                                                                                    }

                                                                                                                } else {

                                                                                                                    response.send( { 'booked': false } )

                                                                                                                }

                                                                                                            }

                                                                                                        })

                                                                                                    } else {

                                                                                                        response.send( { 'booked': false } )

                                                                                                    }

                                                                                                }

                                                                                            }

                                                                                        })

                                                                                    }

                                                                                }

                                                                            }

                                                                        })

                                                                    } else {

                                                                        response.send( { 'booked': false } )

                                                                    }

                                                                }

                                                            })

                                                        } else {

                                                            response.send( { 'booked': false } )

                                                        }

                                                    }

                                                })

                                            } else {

                                                response.send( { 'booked': false } )

                                            }

                                        }

                                    })

                                } else {

                                    response.send( { 'booked': false } )

                                }

                            }

                        })

                    } else {

                        response.send( { 'booked': false } )

                    }

                }

            })

        }

    }

})

app.post('/file_maintenance_complaint', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html' } )


    } else {

        let equipment_info = request.body

        if ( equipment_info.maintenance_comment.length < 0  ) {

            response.send( { 'filed': false } )
            return

        }

        let query_fitness_equipment = "SELECT equipment_id FROM equipment WHERE equipment_id='" + equipment_info.equipment_id + "';"

        client.query(query_fitness_equipment, (err, res) => {

            if ( err ) {

                console.log("")
                console.log(err.message)
                response.send( { 'filed': false } )

            } else {

                if ( res.rowCount === 1 ) {

                    let query = "INSERT INTO equipment_maintenance ( equipment_id, comment ) VALUES (' " + equipment_info.equipment_id + "', '"
                    query += equipment_info.maintenance_comment + "');"

                    client.query( query, (err, res) => {

                        if ( err ) {

                            console.log("There was an error in filing the equipment complaint.")
                            console.log(err.message)
                            response.send( { 'filed': false } )

                        } else {

                            console.log("Equipment Complaint filed.")
                            response.send( { 'filed': true } )

                        }

                    })

                } else {

                    response.send( { 'filed': false } )

                }

            }

        })

    }

})

app.post('/cancel_appt', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let appt_obj = request.body

        let user_name = users.get(request.session.id)
        let query_users_funds = "SELECT funds, points FROM members WHERE user_name='" + user_name + "';"

        client.query(query_users_funds, (err, funds_res) => {

            if ( err ) {

                console.log("There was an error in querying the user's funds.")
                console.log(err.message)

            } else {

                let points = funds_res.rows[0].points
                let funds = funds_res.rows[0].funds
                let allow_refund = true

                //To Stop Infinite point glitch
                if ( points < 10 ) {

                    if ( points >= 5 ) {

                        points -= 5
                        funds += 9

                    } else {

                        allow_refund = false
                    }


                } else {

                    funds += 10
                    points -= 10

                }

                if ( allow_refund === true ) {

                    let update_user_funds_query = "UPDATE members SET funds='" + funds + "', points='" + points + "' WHERE user_name='" + user_name + "';"

                    client.query(update_user_funds_query, (err, res) => {

                        if ( err ) {

                            console.log("There was an error in updating the users funds.")
                            console.log(err.message)
                            response.send( { 'remove' : false } )

                        } else {

                            let query = "DELETE FROM pt_sessions WHERE session_id='" + appt_obj.session_id + "';"

                            client.query(query, (err, res) => {

                                if ( err ) {

                                    console.log("Error in deleteing the ptsession")
                                    console.log(err.message)
                                    response.send( { 'remove' : false } )

                                } else {

                                    let add_transaction_table_query = "INSERT INTO transactions (user_name, amount, description ) VALUES ('"
                                    add_transaction_table_query += user_name + "', '-10', 'Cancelled personal training session' ); "

                                    client.query(add_transaction_table_query, (err, res) => {

                                        if ( err ) {

                                            console.log("There was an error in adding the transaction to the table.")
                                            console.log(err.message)

                                        } else {

                                            console.log("Cancel PT Session added to transaction table.")

                                        }

                                    })

                                    response.send( { 'remove' : true } )

                                }

                            })

                        }

                    })

                } else {

                    response.send( { 'remove' : false } )

                }

            }

        })

    }

})

app.post('/add_notes', (request, response) => {

    if ( trainers.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/trainer_login.html' } )

    } else {

        let notes = request.body.notes
        let session_id = request.body.session_id

        let query = "INSERT INTO pt_notes (session_id, progress_notes) VALUES ('" + session_id + "', '" + notes + "');"

        client.query( query, (err, res) => {

            if ( err ) {

                console.log("Could not update data.")
                console.log(err.message)

            } else {

                console.log("Updated table successfully check table.")

            }

        })

    }

})

app.post('/book_class', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html'} )

    } else {

        let class_id = request.body.class_id

        let request_id = request.session.id

        let user_name = users.get(request_id)

        let query_class_timing = "SELECT class_date, start_time, end_time FROM classes WHERE class_id='" + class_id + "';"

        client.query(query_class_timing, (err, appt_class) => {

            if ( err ) {

                console.log("There was an error in getting the hours of the class.")
                console.log(err.message)
                response.send( { 'booked': false } )

            } else {

                let date = new Date(appt_class.rows[0].class_date)

                let query_users_pt_schedule = "SELECT session_id FROM pt_sessions WHERE pt_date='" + utilities.formatDateYMD(date.toISOString().split('T')[0]) + "'" + " AND member_id='" + user_name + "'"
                query_users_pt_schedule += " AND (('" + appt_class.rows[0].start_time + "'<=start_time AND '" + appt_class.rows[0].start_time + "'>=end_time) OR ('"
                query_users_pt_schedule += appt_class.rows[0].end_time + "'<=start_time AND '" + appt_class.rows[0].end_time + "'>=end_time));"

                client.query(query_users_pt_schedule, (err, res) => {

                    if ( err ) {

                        console.log("There was an error in querying the user's personal training sessions.")
                        console.log(err.message)
                        response.send( { 'booked': false } )

                    } else {

                        if ( res.rowCount === 0 ) {

                            let query_users_class_schedule = "SELECT class_id FROM users_taking_class WHERE member_id='" + user_name + "';"

                            client.query(query_users_class_schedule, (err, res) => {

                                if ( err ) {

                                    console.log("There was an error in querying the users classes.")
                                    console.log(err.message)
                                    response.send( { 'booked': false } )

                                } else {

                                    if ( res.rowCount === 0 ) {

                                        let query_user_funds = "SELECT funds, points, payment_date FROM members WHERE user_name='" + user_name + "';"

                                        client.query(query_user_funds, (err, user_funds_res) => {

                                            if ( err ) {

                                                console.log("There was an error in getting the users funds.")
                                                console.log(err.message)
                                                response.send( { 'booked': false } )

                                            } else {

                                                let funds = parseInt(user_funds_res.rows[0].funds)
                                                let points = parseInt(user_funds_res.rows[0].points)


                                                let payment_date = user_funds_res.rows[0].payment_date
                                                let class_date = date


                                                payment_date = new Date(payment_date)
                                                payment_date = utilities.formatDateYMDObj(payment_date.toISOString().split('T')[0])
                                                payment_date = utilities.incrementDays(payment_date, 0, 1, 0)
                                                class_date = utilities.formatDateYMDObj(class_date.toISOString().split('T')[0])

                                                if ( utilities.dateLess(class_date, payment_date) === true ) {

                                                    if ( funds >= 5 ) {

                                                        funds -= 5
                                                        points += 5

                                                        let query_update_user_funds = "UPDATE members SET funds='" + funds + "', points='" + points + "' WHERE user_name='" + user_name + "';"

                                                        client.query(query_update_user_funds, (err, res) => {

                                                            if ( err ) {

                                                                console.log("There was an error in updating the user's funds.")
                                                                console.log(err.message)
                                                                response.send( { 'booked': false } )

                                                            } else {


                                                                let query = "INSERT INTO users_taking_class ( class_id, member_id ) VALUES ('" + class_id + "', '" + user_name +"');"

                                                                client.query( query, (err, res) => {

                                                                    if ( err ) {

                                                                        console.log("Error in updating the booked classes.")
                                                                        console.log(err.message)
                                                                        response.send( { 'booked': false } )

                                                                    } else {

                                                                        let add_transaction_to_table = "INSERT INTO transactions (user_name, amount, description) VALUES ('"
                                                                        add_transaction_to_table += user_name + "', '5', 'User booked a class');"

                                                                        client.query(add_transaction_to_table, (err, res) => {

                                                                            if ( err ) {

                                                                                console.log("There was an error adding the transaction to the transaction table.")
                                                                                console.log(err.message)

                                                                            } else {

                                                                                console.log("Transaction for booking class added to the table.")

                                                                            }
                                                                        })

                                                                        response.send( { 'booked': true } )

                                                                    }

                                                                })

                                                            }

                                                        })

                                                    } else {

                                                        response.send( { 'booked': false } )

                                                    }

                                                } else {

                                                    response.send( { 'booked': false } )

                                                }

                                            }

                                        })

                                    } else {

                                        let valid = true

                                        for ( let i = 0 ; i < res.rowCount; i++ ) {

                                            let query_class = "SELECT class_date, start_time, end_time FROM classes WHERE class_id='" + class_id + "';"

                                            client.query(query_class, (err, class_result) => {

                                                if ( err ) {

                                                    console.log("There was an error in getting the class.")
                                                    console.log(err.message)

                                                    response.send( { 'booked': false } )

                                                } else {

                                                    if ( (appt_class.rows[0].class_date === class_result.rows[0].class_date) &&
                                                         (((appt_class.rows[0].start_time <= class_result.rows[0].start_time) && (class_result.rows[0].start_time <= appt_class.rows[0].end_time)) || 
                                                         ((appt_class.rows[0].start_time <= class_result.rows[0].end_time) && (class_result.rows[0].end_time <= appt_class.rows[0].end_time)))
                                                       ) {

                                                        valid = false

                                                    }


                                                    if ( i === res.rowCount - 1 ) {

                                                        if ( valid === false ) {

                                                            response.send( { 'booked': false } )

                                                        } else {

                                                            let query_user_funds = "SELECT funds, points, payment_date FROM members WHERE user_name='" + user_name + "';"

                                                            client.query(query_user_funds, (err, user_funds_res) => {

                                                                if ( err ) {

                                                                    console.log("There was an error in querying the user's funds.")
                                                                    console.log(err.message)

                                                                } else {

                                                                    let funds = parseInt(user_funds_res.rows[0].funds)
                                                                    let points = parseInt(user_funds_res.rows[0].points)
                                                                    let payment_date = user_funds_res.rows[0].payment_date
                                                                    let class_date = appt_class.rows[0].class_date


                                                                    payment_date = new Date(payment_date)
                                                                    class_date = new Date(class_date)
                                                                    payment_date = utilities.formatDateYMDObj(payment_date.toISOString().split('T')[0])
                                                                    payment_date = utilities.incrementDays(payment_date, 0, 1, 0)
                                                                    class_date = utilities.formatDateYMDObj(class_date.toISOString().split('T')[0])

                                                                    if ( utilities.dateLess(class_date, payment_date) === true ) {

                                                                        if ( funds >= 5 ) {

                                                                            funds -= 5
                                                                            points += 5

                                                                            let query_update_users_funds  = "UPDATE members SET funds='" + funds + "', points='" + points + "' WHERE user_name='" + user_name + "';"

                                                                            client.query(query_update_users_funds, (err, funds_res) => {

                                                                                if ( err ) {

                                                                                    console.log("There was an error in updating the users funds.")
                                                                                    console.log(err.message)

                                                                                    response.send( { 'booked': false } )

                                                                                } else {

                                                                                    let query = "INSERT INTO users_taking_class ( class_id, member_id ) VALUES ('" + class_id + "', '" + user_name +"');"

                                                                                    client.query( query, (err, res) => {

                                                                                        if ( err ) {

                                                                                            console.log("Error in updating the booked classes.")
                                                                                            console.log(err.message)
                                                                                            response.send( { 'booked': false } )

                                                                                        } else {


                                                                                            let add_transaction_to_table = "INSERT INTO transactions (user_name, amount, description) VALUES ('"
                                                                                            add_transaction_to_table += user_name + "', '5', 'User booked a class');"

                                                                                            client.query(add_transaction_to_table, (err, res) => {

                                                                                                if ( err ) {

                                                                                                    console.log("There was an error adding the transaction to the transaction table.")
                                                                                                    console.log(err.message)

                                                                                                } else {

                                                                                                    console.log("Transaction for booking class added to the table.")

                                                                                                }

                                                                                            })

                                                                                            response.send( { 'booked': true } )

                                                                                        }

                                                                                    })

                                                                                }

                                                                            })

                                                                        } else {

                                                                            response.send( { 'booked': false } )

                                                                        }

                                                                    } else {

                                                                        response.send( { 'booked': false } )

                                                                    }

                                                                }

                                                            })

                                                        }

                                                    }

                                                }

                                            })

                                        }

                                    }

                                }

                            })

                        } else {

                            response.send( { 'booked': false } )

                        }

                    }

                })

            }

        })

    }

})

app.get( __dirname + '/html/payment_info.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile( __dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/payment_info.html')

    }

})

app.get('/request_payment_update_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/payment_info.html' } )

    }

})

app.get('/request_previous_workouts_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html'} )

    } else {

        response.send( { 'file_name': __dirname + '/html/view_previous_workouts.html' } )

    }

})

app.get('/request_equipment_maintenance_requests', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html'} )

    } else {

        response.send( {'file_name': __dirname + '/html/equipment_maintenance_requests.html'} )

    }
})

app.get(__dirname + '/html/equipment_maintenance_requests.html', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/admin_login.html')

    } else {

        response.sendFile(__dirname + '/html/equipment_maintenance_requests.html')

    }

})

app.get('/request_admin_feedback_page', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html'} )

    } else {

        response.send( { 'file_name': __dirname + '/html/view_user_feedback.html'} )

    }

})

app.get('/request_user_feedback', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html'} )

    } else {

        let query_user_feedback = "SELECT * from feedback;"

        client.query(query_user_feedback, (err, res) => {

            if ( err ) {

                response.send( { 'feedback': [] } )

            } else {

                response.send( { 'feedback': res.rows } )

            }

        })

    }

})

app.post('/remove_feedback', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html'} )

    } else {

        let feedback = request.body

        let remove_feedback_query = "DELETE FROM feedback WHERE feedback_id='" + feedback.feedback_id + "';"

        client.query(remove_feedback_query, (err, res) => {

            if ( err ) {

                response.send( { 'deleted' : false } )

            } else {

                response.send( { 'deleted' : true } )

            }

        })

    }
})

app.get(__dirname + '/html/view_user_feedback.html', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/admin_login.html')

    } else {

        response.sendFile(__dirname + '/html/view_user_feedback.html')

    }

})

app.get('/request_complaints', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name' : __dirname + '/html/admin_login.html' } )

    } else {

        let query_complaints = "SELECT * FROM equipment_maintenance;"

        client.query(query_complaints, (err, res) => {

            if ( err ) {

                console.log("There was an error querying the maintenance requests.")
                console.log(err.message)

            } else {

                if ( res.rowCount === 0 ) {

                    response.send( { 'complaints': [] } )

                } else {

                    for ( let i = 0; i < res.rowCount; i++ ) {

                        let date = new Date(res.rows[i].request_date)

                        res.rows[i].request_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]))

                        let query_machine_name = "SELECT equipment_name FROM equipment WHERE equipment_id='" + res.rows[i].equipment_id + "';"

                        client.query(query_machine_name, (err, result) => {

                            if ( err ) {

                                console.log("There was an error in querying the equipments name.")
                                console.log(err.message)

                            } else {

                                if ( result.rowCount === 0 ) {

                                    console.log("Could not find equipment with the given name.")

                                } else {

                                    res.rows[i].equipment_name = result.rows[0].equipment_name

                                }

                                if ( i === res.rowCount - 1 ) {

                                    console.log("SENDING")
                                    response.send( { 'complaints': res.rows } )

                                }

                            }

                        })

                    }

                }

            }

        })

    }

})

app.get(__dirname + '/html/view_previous_workouts.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/view_previous_workouts.html')

    }

})

app.get('/request_workouts', (request, response) => {

    if ( users.has(request.session.id) == false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let query_user_workouts = "SELECT workout_id, workout_date, workout_length FROM workouts WHERE member_id='" + user_name + "';"

        client.query(query_user_workouts, (err, result) => {

            if ( err ) {

                console.log("There was an error in querying the member's previous workouts.")
                console.log(err.message)

            } else {

                if ( result.rowCount === 0 ) {

                    response.send( { 'workouts': result.rows } )

                } else {

                    let workouts = []

                    for ( let i = 0; i < result.rowCount; i++ ) {

                        let workout_id = result.rows[i].workout_id

                        let date = new Date(result.rows[i].workout_date)

                        result.rows[i].workout_date = utilities.convertDateToString( utilities.formatDateDMY(date.toISOString().split('T')[0]))

                        let workout = {
                            'workout_date': result.rows[i].workout_date,
                            'workout_length': result.rows[i].workout_length
                        }

                        workouts.push(workout)

                        let query_machines_used_in_workout_session = "SELECT equipment_name, notes FROM machines_used WHERE workout_id='" + workout_id + "';"

                        client.query(query_machines_used_in_workout_session, (err, res) => {

                            if ( err ) {

                                console.log("There was an error in getting the machines this used used during this workout.")
                                console.log(err.message)

                            } else {

                                if ( i === result.rowCount - 1 ) {

                                    if ( res.rowCount === 0 ) {

                                        response.send( { 'workouts': workouts } )

                                    }

                                } else {

                                    let machines_used = []

                                    for ( let j = 0; j < res.rowCount; j++ ) {

                                        let query_machine_name = "SELECT equipment_name FROM equipment WHERE equipment_id='" + res.rows[j].equipment_name + "';"

                                        client.query( query_machine_name, (err, name_res) => {

                                            if ( err ) {

                                                console.log("There was an error in querying the machine name.")
                                                console.log(err.message)

                                            } else {

                                                let machine = {
                                                    'equipment_name': name_res.rows[0].equipment_name,
                                                    'notes': res.rows[j].notes,
                                                    'equipment_id': res.rows[j].equipment_name
                                                }

                                                machines_used.push(machine)

                                                if ( j === res.rowCount - 1 ) {

                                                    workouts[workouts.length - 1].machines_used = machines_used

                                                    if ( i === result.rowCount - 1 ) {

                                                        response.send( { 'workouts': workouts } )

                                                    }

                                                }

                                            }

                                        })

                                    }

                                }

                            }

                        })

                    }

                }

            }

        })

    }

})

app.get('/request_reminders_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( {'file_name': __dirname + 'html/user_login.html'} )

    } else {

        response.send( {'file_name': __dirname + 'html/reminders_page.html'} )

    }
})

app.get( __dirname + 'html/reminders_page.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile( __dirname + '/html/user_login.html')

    } else {

        response.sendFile( __dirname + '/html/reminders_page.html')

    }

})

app.get('/request_montly_fee_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/monthly_fee.html' } )

    }

})

app.get(__dirname + '/html/monthly_fee.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/monthly_fee.html')

    }

})

app.post('/request_user_payment_date', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {


        let user_name = users.get(request.session.id)
        let query_user_payment_date = "SELECT payment_date FROM members WHERE user_name='" + user_name + "';"

        client.query( query_user_payment_date, (err, res) => {

            if ( err ) {

                console.log("There was an error getting the users last payment date.")
                console.log(err.message)
                response.send( { 'payment_date_not_found': false } )

            } else {

                if ( res.rowCount === 1 ) {

                    let query_current_date = "SELECT CURRENT_DATE;"

                    client.query(query_current_date, (err, curr_date_response) => {

                        if ( err ) {

                            console.log("There was an error in querying the current date.")
                            console.log(err.message)

                        } else {

                            if ( curr_date_response.rowCount === 1 ) {

                                let curr_date = new Date(curr_date_response.rows[0].current_date)

                                curr_date = utilities.formatDateYMDObj(  curr_date.toISOString().split('T')[0] )

                                if ( res.rowCount === 1 ) {

                                    let date = new Date(res.rows[0].payment_date)
                                    let payment_date = utilities.formatDateYMDObj( date.toISOString().split('T')[0] )

                                    while ( utilities.dateLess(payment_date,curr_date) ) {

                                        payment_date = utilities.incrementDays(payment_date, 0, 1, 0 )

                                    }

                                    response.send( { 'payment_date': utilities.convertDateToStringYMD(payment_date) } )

                                } else {

                                    response.send( { 'payment_date_not_found': false } )

                                }

                            } else {

                                response.send( { 'payment_date_not_found': false } )

                            }

                        }

                    })

                } else {

                    response.send( { 'payment_date_not_found': false } )

                }

            }

        })

    }

})

app.post('/pay_monthly_fee', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( {'file_name': __dirname + '/html/user_login.html'})

    } else {

        let user_name = users.get(request.session.id)
        let query_last_payment_date = "SELECT payment_date, funds FROM members WHERE user_name='" + user_name + "';"

        client.query(query_last_payment_date, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the user's last payment.")
                console.log(err.message)

            } else {

                    let query_current_date = "SELECT CURRENT_DATE;"

                    client.query(query_current_date, (err, curr_date_response) => {

                        if ( err ) {

                            console.log("There was an error in querying the current date.")
                            console.log(err.message)

                        } else {

                            if ( curr_date_response.rowCount === 1 ) {

                                let curr_date = new Date(curr_date_response.rows[0].current_date)

                                curr_date = utilities.formatDateYMDObj(  curr_date.toISOString().split('T')[0] )

                                if ( (res.rowCount === 1) ) {

                                    if ( parseInt(res.rows[0].funds) >= 15 ) {

                                        let date = new Date(res.rows[0].payment_date)
                                        let payment_date = utilities.formatDateYMDObj( date.toISOString().split('T')[0] )

                                        if ( utilities.dateLess(payment_date, curr_date) === true ) {

                                            while ( utilities.dateLess(payment_date,curr_date) ) {

                                                payment_date = utilities.incrementDays(payment_date, 0, 1, 0 )

                                            }

                                        } else {

                                            payment_date = utilities.incrementDays(payment_date, 0, 1, 0 )

                                        }

                                        payment_date = utilities.convertDateToStringYMD(payment_date)

                                        let query_update_member_information = "UPDATE members SET payment_date='" + payment_date + "', funds='" + (parseInt(res.rows[0].funds) - 15) + "' WHERE user_name='" + user_name + "';"

                                        client.query(query_update_member_information, (err, res) => {

                                            if ( err ) {

                                                console.log("There was an error in updating the payment date.")
                                                console.log(err.message)
                                                response.send ( {'fee_payed': false} )

                                            } else {

                                                let update_transaction_table_with_monthly_fee = "INSERT INTO transactions (user_name, amount, description) VALUES ('" + user_name + "', '15', 'Paid monthly fee');"

                                                client.query(update_transaction_table_with_monthly_fee, (err, res) => {

                                                    if ( err ) {

                                                        console.log("There was an error in updating the transcation table with the monthly fee.")
                                                        console.log(err.message)

                                                    } else {

                                                        console.log("Successfully updated transaction table with monthly payment.")

                                                    }

                                                })

                                                response.send ( {'fee_payed': true} )

                                            }

                                        })

                                    } else {

                                        response.send ( {'fee_payed': false} )

                                    }

                                } else {

                                    response.send ( {'fee_payed': false} )

                                }

                            } else {

                                response.send ( {'fee_payed': false} )

                            }

                        }

                    })

            }

        })

    }

})


app.get('/request_transaction_page', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/transactions.html' } )

    }

})


app.get( __dirname + '/html/transactions.html', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.sendFile( __dirname + '/html/admin_login.html')

    } else {

        response.sendFile(__dirname + '/html/transactions.html')

    }

})


app.get('/request_transactions', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let query_transactions = "SELECT * FROM transactions ORDER BY date;"

        client.query(query_transactions, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the transcations.")
                console.log(err.message)

            } else {

                for ( let i = 0; i < res.rowCount; i++ ) {

                    let date = new Date(res.rows[i].date)

                    res.rows[i].date = utilities.formatDateDMY(date.toISOString().split('T')[0])
                    res.rows[i].date = utilities.convertDateToStringYMD(res.rows[i].date)

                }

                response.send({'transactions': res.rows})
            }
        })

    }
})

app.get('/request_pt_sessions_in_next_week', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let query_current_date = "SELECT CURRENT_DATE;"

        client.query(query_current_date, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the current date.")
                console.log(err.message)
                response.send({'error': true})

            } else {

                let curr_date = new Date(res.rows[0].current_date)
                curr_date = utilities.formatDateYMDObj(  curr_date.toISOString().split('T')[0] )

                let week_from_now = utilities.deepCopy(curr_date)
                week_from_now = utilities.incrementDays(week_from_now, 7, 0, 0)
                week_from_now = utilities.convertDateToStringYMD(week_from_now)

                curr_date = utilities.convertDateToStringYMD(curr_date)

                let query_users_pt_sessions = "SELECT session_id, pt_date, start_time, end_time, trainer_id FROM pt_sessions WHERE member_id='" + user_name + "'"
                query_users_pt_sessions += " AND '" + curr_date + "'<=pt_date AND pt_date<='" + week_from_now + "';"

                console.log(query_users_pt_sessions)

                client.query(query_users_pt_sessions, (err , res ) => {

                    if ( err ) {

                        console.log("There was an error in getting the users personal training sessions.")
                        console.log(err.message)
                        response.send({'error': true})

                    } else {

                        let pt_sessions = []

                        if ( res.rowCount === 0 ) {

                            response.send({'pt_sessions': pt_sessions})

                        } else {

                            for ( let i = 0; i < res.rowCount; i++ ) {

                                let date = new Date(res.rows[i].pt_date)

                                res.rows[i].pt_date = utilities.formatDateDMY(date.toISOString().split('T')[0])
                                res.rows[i].pt_date = utilities.convertDateToStringYMD(res.rows[i].pt_date)

                                let query_trainer_name = "SELECT first_name, last_name FROM trainers WHERE trainer_id='" + res.rows[i].trainer_id + "';"

                                client.query(query_trainer_name, (err, trainer_result) => {

                                    if ( err ) {

                                        console.log("There was an error in querying the trainer's name.")
                                        console.log(err.message)

                                    } else {

                                        res.rows[i].trainer_name = trainer_result.rows[0].first_name + " " + trainer_result.rows[0].last_name
                                        console.log(res.rows[i].trainer_name)
                                        pt_sessions.push(res.rows[i])

                                    }

                                    if ( i === res.rowCount - 1 ) {

                                        response.send({'pt_sessions': pt_sessions})

                                    }

                                })


                            }

                        }

                    }

                })

            }

        })

    }

})

app.get('/request_classes_in_the_next_week', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let query_current_date = "SELECT CURRENT_DATE;"

        client.query( query_current_date, (err, res) => {

            if ( err ) {

                console.log("There was an error querying the current date.")
                console.log(err.message)
                response.send({'error': true})

            } else {

                if ( res.rowCount === 1 ) {

                    let curr_date = new Date(res.rows[0].current_date)
                    curr_date = utilities.formatDateYMDObj(  curr_date.toISOString().split('T')[0] )
                    let user_name = users.get(request.session.id)

                    let week_from_now = utilities.deepCopy(curr_date)
                    week_from_now = utilities.incrementDays(week_from_now, 7, 0, 0)

                    let query_user_classes = "SELECT class_id FROM users_taking_class WHERE member_id='" + user_name + "';"

                    client.query(query_user_classes, (err, class_res) => {

                        if ( err ) {

                            console.log("There was an error in getting the user's class.")
                            console.log(err.message)

                        } else {

                            if ( class_res.rowCount === 0 ) {

                                console.log("1")
                                response.send( { 'classes': [] } )

                            } else {

                                let classes = []

                                for ( let i = 0; i < class_res.rowCount; i++ ) {

                                    let query_class_in_next_week = "SELECT class_date, start_time, trainer_id, end_time FROM classes WHERE class_id='" + class_res.rows[i].class_id + "';"

                                    client.query( query_class_in_next_week, (err, res) => {

                                        if ( err ) {

                                            console.log("There was an error in getting the class with this id.")
                                            console.log(err.message)

                                        } else {

                                            if ( res.rowCount === 0 ) {

                                                response.send({'error': true})

                                            } else {

                                                let date = new Date(res.rows[0].class_date)

                                                res.rows[0].class_date = utilities.formatDateDMY(date.toISOString().split('T')[0])

                                                let class_date = res.rows[0].class_date

                                                if ( utilities.dateLess(curr_date, class_date) === true ) {

                                                    if ( utilities.dateLess(class_date, week_from_now) === true ) {

                                                        let query_trainer_name = "SELECT first_name, last_name FROM trainers WHERE trainer_id='" + res.rows[0].trainer_id + "';"

                                                        client.query(query_trainer_name, (err, trainer_name_result) => {

                                                            if ( err ) {

                                                                console.log("There was an error in getting the trainers name.")
                                                                console.log(err.message)

                                                            } else {

                                                                res.rows[0].trainer_name = trainer_name_result.rows[0].first_name + ' ' + trainer_name_result.rows[0].last_name
                                                                res.rows[0].class_date = utilities.convertDateToStringYMD(res.rows[0].class_date)
                                                                classes.push(res.rows[0])

                                                                if ( i === class_res.rowCount - 1 ) {

                                                                    console.log("2")
                                                                    response.send( { 'classes': classes } )

                                                                }

                                                            }

                                                        })

                                                    } else if ( i === class_res.rowCount - 1 ) {

                                                        console.log("3")
                                                        console.log(curr_date)
                                                        console.log(week_from_now)
                                                        console.log(class_date)
                                                        response.send( { 'classes': classes } )

                                                    }

                                                } else if ( i === class_res.rowCount - 1 ) {

                                                    console.log(curr_date)
                                                    console.log(week_from_now)
                                                    console.log(class_date)
                                                    console.log("4")
                                                    response.send( { 'classes': classes } )

                                                }

                                            }

                                        }

                                    })

                                }

                            }

                        }

                    })

                } else {

                    response.send({'error': true})

                }

            }

        })

    }

})

app.post('/delete_complaint', (request, response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {


        let complaint = request.body
        let query_to_delete_complaint = "DELETE FROM equipment_maintenance WHERE request_id='" + complaint.request_id + "';"

        client.query(query_to_delete_complaint, (err, res) => {

            if ( err ) {

                console.log("There was an error in deleting the complaint from the database.")
                response.send( { 'deleted': false } )

            } else {

                response.send( { 'deleted': true } )

            }

        })

    }

})

app.get('/request_user_feedback_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/leave_feedback.html'} )

    }

})

app.get(__dirname + '/html/leave_feedback.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/leave_feedback.html')

    }

})

app.post('/add_feedback', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let feedback = request.body.feedback

        if ( feedback.length === 0 ) {

            response.send( { 'added': false } )

        } else {

            let add_feedback_query = "INSERT INTO feedback ( user_name, feedback ) VALUES ( '" + user_name + "', '" + feedback + "');";

            client.query(add_feedback_query, (err, res) => {

                if ( err ) {

                    console.log("There was an error inserting the feedback in the table.")
                    response.send( { 'added': false } )

                } else {

                    response.send( { 'added': true } )

                }

            })

        }

    }

})

app.post('/update_card_info', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let ret_obj = {
            'saved': false,
            'from_sign_up_page': __dirname + '/html/home_page.html'
        }

        let payment_info = request.body

        if ( (validateUserAttribute(payment_info.card_holder_name) === true) &&
             (payment_info.expiration_date.length  === 5) &&
             (payment_info.card_number.length > 0) ) {

            let user_name = users.get(request.session.id)

            let update_payment_info_query = "UPDATE members SET card_type='" + payment_info.card_type + "', "
            update_payment_info_query += "card_holder_name='" + payment_info.card_holder_name + "', "
            update_payment_info_query += "card_number='" + payment_info.card_number + "', "
            update_payment_info_query += "expiration_date='" + payment_info.expiration_date + "' WHERE user_name='" + user_name + "';"

            client.query( update_payment_info_query, (err, res) => {

                if ( err ) {

                    console.log("There was an error in updated the user's payment info")
                    console.log(err.message)
                    response.send(ret_obj)

                } else {

                    ret_obj.saved = true
                    response.send(ret_obj)

                }
            })

        } else {

            response.send(ret_obj)

        }

    }

})


app.get('/request_user_funds_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send( { 'file_name': __dirname + '/html/add_funds.html' } )

    }

})

app.get(__dirname + '/html/add_funds.html', ( request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/add_funds.html')

    }

})

app.post('/get_user_funds', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let user_fund_query = "SELECT funds, points FROM members WHERE user_name='" + user_name + "';"

        client.query(user_fund_query, (err, res) => {

            if ( err ) {

                console.log("There was an error in getting the user's funds.")
                console.log(err.message)
                response.send( {'funds_found': false} )

            } else {

                if ( res.rowCount === 1 ) {

                    response.send( {'funds': res.rows[0].funds, 'points': res.rows[0].points } )

                } else {

                    response.send( {'funds_found': false} )

                }

            }

        })

    }
})

app.post('/redeem_points', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let query_user_points = "SELECT funds, points FROM members WHERE user_name='" + user_name + "';"

        client.query(query_user_points, (err, res) => {

            if ( err ) {

                console.log("There was an error in querying the users funds and points.")
                console.log(err.message)
                response.send( {'redeemed': false} )

            } else {

                if ( res.rowCount === 1 ) {

                    let new_funds = parseInt(res.rows[0].funds) + (parseInt(res.rows[0].points) / 5) //Five points = $1

                    let update_user_funds_and_points_query = "UPDATE members SET funds='" + new_funds + "', points='0' WHERE user_name='" + user_name + "';"

                    client.query(update_user_funds_and_points_query, ( err, res ) => {

                        if ( err ) {

                            console.log("There was an error in updating the users points and funds.")
                            console.log(err.message)
                            response.send( {'redeemed': false} )

                        } else {

                            response.send( {'new_funds': new_funds } )

                        }

                    })

                } else {

                    response.send( {'redeemed': false} )

                }

            }

        })

    }

})

app.post('/add_to_users_funds', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let user_name = users.get(request.session.id)

        let get_user_funds_query = "SELECT funds FROM members WHERE user_name='" + user_name + "';"
        let new_funds = parseInt(request.body.funds)

        if ( new_funds < 0 ) {

            response.send( { 'added': false } )

        }

        client.query(get_user_funds_query, (err, res) => {

            if ( err ) {

                console.log("There was a problem getting the users funds.")
                console.log(err.message)
                response.send( { 'added': false } )

            } else {

                if ( res.rowCount === 1 ) {

                    let current_funds = parseInt(res.rows[0].funds)

                    new_funds += current_funds

                    let update_funds_query = "UPDATE members SET funds='" + new_funds + "' WHERE user_name='" + user_name + "';"
                    client.query(update_funds_query, (err, res) => {

                        if ( err ) {

                            console.log("There was an error updating the user's funds.")
                            console.log(err.message)
                            response.send( { 'added': false } )

                        } else {

                            response.send( { 'added': true } )

                        }

                    })

                } else {

                    response.send( { 'added': false } )

                }

            }

        })

    }

})


app.post('/user_goals', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        let goals = request.body
        let ret_obj = {
            'goal_saved': false,
            'from_sign_up_page': __dirname + '/html/home_page.html'
        }

        if ( validateUserGoals(goals) === true ) {

            let user_name = users.get(request.session.id)

            let query = "INSERT INTO user_goals (user_name, date_goal_set, weight_goal, daily_exercise_minutes, daily_caloric_intake) VALUES "
            query += "('" + user_name + "', CURRENT_DATE, '" + goals.weight_goal +  "', '" + goals.daily_exercise_minutes + "', '" + goals.daily_caloric_intake + "')"
            query += " RETURNING goal_id;"

            client.query(query, (err, res) => {

                if ( err ) {

                    console.log("There was an error saving the goals for this user:")
                    console.log(err.message)

                } else {

                    if ( res.rowCount === 0 ) { //Should not trigger this case but just for safety

                        console.log("There was an error in inserting the data in the table.")
                        response.send( ret_obj )
                        return

                    }

                    let goal_id = res.rows[0].goal_id

                    for ( let i = 0; i < goals.exercise_days.length; i++ ) {

                        let exercise_days_query = "INSERT INTO goal_exercise_dates (goal_id, week_day) VALUES ('" + goal_id + "', '" + goals.exercise_days[i] + "');"

                        client.query(exercise_days_query, (err,res) => {

                            if ( err ) {

                                console.log("Could not add the exercise days.")
                                console.log(err.message)

                                response.send( ret_obj )
                                return

                            } else {

                                ret_obj.goal_saved = true

                                if ( i === goals.exercise_days.length - 1 ) {

                                    response.send( ret_obj )
                                }

                            }

                        })

                    }

                }

            })

        } else {

            response.send( { 'goal_saved': false } )
        }

    }

})


app.get('/request_trainers', (request,response) => {

    if ( admins.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/admin_login.html' } )

    } else {

        let query_trainers = "SELECT first_name, last_name, trainer_id FROM trainers;"

        client.query(query_trainers, (err, res) => {

            if ( err ) {

                console.log("There was an error in querying the trainer's list.")
                console.log(err.message)

            } else {

                response.send( { 'trainers': res.rows } )

            }

        })


    }

})

app.get('/request_record_workout_page', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.send( { 'file_name': __dirname + '/html/user_login.html' } )

    } else {

        response.send ( { 'file_name': __dirname + '/html/record_workout.html'} )

    }

})


app.get(__dirname + '/html/record_workout.html', (request, response) => {

    if ( users.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/user_login.html')

    } else {

        response.sendFile(__dirname + '/html/record_workout.html')

    }
})

app.post('/sign_up_information', (request, response) => {

    let sign_up_info = request.body
    let user_name = sign_up_info.user_name
    let user_password = sign_up_info.user_password

    let info_valid = true

    if ( sign_up_info.re_user_password !== sign_up_info.user_password ) {

       info_valid = false

    }

    if ( validateUserAttribute(sign_up_info.user_name) === false ) {

        info_valid = false

    }

    if ( validateUserAttribute(sign_up_info.first_name) === false ) {

        info_valid = false

    }

    if ( validateUserAttribute(sign_up_info.last_name) === false ) {

        info_valid = false

    }

    if ( validateUserAttribute(sign_up_info.birth_day) === false ) {

        info_valid = false

    }

    if ( validateUserAttribute(sign_up_info.user_password) === false ) {

        info_valid = false

    }

    if ( validateUserAttribute(sign_up_info.card_holder_name) === false ) {

        info_valid = false

    }

    if ( sign_up_info.funds.length === 0 ) {

        sign_up_info.funds = 0

    } else if ( sign_up_info.funds < 0 ) {

        info_valid = false

    }

    if ( sign_up_info.expiration_date.length < 5 ) {

        info_valid = false

    }

    if ( sign_up_info.card_number.length === 0 ) {

        info_valid = false

    }


    if ( info_valid === true ) {

        let query_if_user_name_used = "SELECT user_name FROM members WHERE user_name='" + sign_up_info.user_name + "';"

        client.query(query_if_user_name_used, (err, res) => {

            if ( err ) {

                console.log("There was an error in determining if the user id is being used.")
                console.log(err.message)
                response.send( { 'registeration': false } )

            } else {

                if ( res.rowCount === 0 ) {

                    let insert_new_user_query = "INSERT INTO members ("

                    insert_new_user_query += "user_name,"
                    insert_new_user_query += "email,"
                    insert_new_user_query += "birth_day,"
                    insert_new_user_query += "password,"
                    insert_new_user_query += "first_name,"
                    insert_new_user_query += "last_name,"
                    insert_new_user_query += "payment_date,"
                    insert_new_user_query += "card_type,"
                    insert_new_user_query += "card_holder_name,"
                    insert_new_user_query += "card_number,"
                    insert_new_user_query += "expiration_date,"
                    insert_new_user_query += "funds,"
                    insert_new_user_query += "points)"
                    insert_new_user_query += " VALUES ( '"
                    insert_new_user_query += sign_up_info.user_name + "', '"
                    insert_new_user_query += sign_up_info.email + "', '"
                    insert_new_user_query += sign_up_info.birth_day + "', '"
                    insert_new_user_query += sign_up_info.user_password + "', '"
                    insert_new_user_query += sign_up_info.first_name + "', '"
                    insert_new_user_query += sign_up_info.last_name + "', "
                    insert_new_user_query += "CURRENT_DATE , '"
                    insert_new_user_query += sign_up_info.card_type + "', '"
                    insert_new_user_query += sign_up_info.card_holder_name + "', '"
                    insert_new_user_query += sign_up_info.card_number + "', '"
                    insert_new_user_query += sign_up_info.expiration_date + "', '"
                    insert_new_user_query += sign_up_info.funds + "', '"
                    insert_new_user_query += "0');"

                    console.log(insert_new_user_query)

                    client.query(insert_new_user_query, (err, res) => {

                        if ( err ) {

                            console.log("There was an error in adding new user to the database:")
                            console.log(err.message)

                        } else {

                            request.session.user = {
                                user_name, user_password
                            }

                            let file_name = { 'file_name' : __dirname + '/html/user_goals.html'}
                            users.set(request.session.id, user_name) //User logged in -> Keep track of this user
                            response.send(file_name)

                        }

                    })

                } else {

                    response.send( { 'registeration': false } )

                }

            }

        })

    } else {

        response.send( { 'registeration': false } )

    }

})

app.post('/sign_up', (request, response) => {

    let file_name = { 'file_name': __dirname + '/html/sign_up_page.html'}
    response.send(file_name)

})

app.post('/login_admin', (request, response) => {

    let admin_id = request.body.admin_id
    let admin_password = request.body.admin_password

    let query = "SELECT * FROM admins WHERE admin_id='" + admin_id + "' AND password='" + admin_password + "';"

    client.query(query, (err, res) => {

        if ( err ) {

            console.log("There was an error in retrieving the admin data.")
            console.log(err.message)
            response.send( {'login': false } )

        } else {

            if ( res.rowCount === 0 ) {

                response.send( {'login': false } )

            } else {

                request.session.user = {
                    admin_id, admin_password
                }

                let file_name = { 'file_name' : __dirname + '/html/admin_home_page.html'}
                admins.set(request.session.id, admin_id) //User logged in -> Keep track of this user
                response.send(file_name)

            }

        }

    })


})

app.get(__dirname + '/html/admin_home_page.html', (request,response) => {

    if ( admins.has(request.session.id) === false ) {

        response.sendFile(__dirname + '/html/admin_login.html')

    } else {

        response.sendFile(__dirname + '/html/admin_home_page.html')
    }


})

app.post('/login_trainer', (request, response) => {

    let trainer_id = request.body.trainer_id
    let trainer_password = request.body.trainer_password

    let query = "SELECT * FROM trainers t WHERE t.trainer_id='" + trainer_id + "' AND t.password='" + trainer_password + "';"

    client.query(query, (err, res) => {

        if ( err ) {

            console.log("There was an error when looking for the trainer id.")
            console.log(err.message)
            response.send( { 'valid': false } )

        } else {

            if ( res.rowCount === 0 ) {

                console.log("Could not find a trainer with this id and password")
                response.send( { 'valid': false } )

            } else {

                request.session.user = {
                    trainer_id, trainer_password
                }

                let file_name = { 'file_name' : __dirname + '/html/trainer_home_page.html'}
                trainers.set(request.session.id, trainer_id) //trainer logged in -> Keep track of this trainer
                response.send(file_name)

            }
        }

    })


})

app.post('/login_user', (request, response) => {

    let user_name = request.body.user_name
    let user_password = request.body.user_password

    let query = "SELECT * from members m where m.user_name='" + user_name + "' and m.password='" + user_password + "';"

    client.query(query, (err, res) => {

        if ( err ) {

            console.log("error retrieving login query")
            console.log(err.message)

        } else {

            if ( res.rowCount === 0 ) { //query returned no users with the given user name and password

                response.send( { 'user_not_found': true } )
                return

            } else {

                request.session.user = {
                    user_name, user_password
                }

                let file_name = { 'file_name' : __dirname + '/html/home_page.html'}
                users.set(request.session.id, user_name) //User logged in -> Keep track of this user
                response.send(file_name)

            }

        }

    })
 
})


app.listen(3000, function() {

    console.log(`Static Server listening on PORT 3000, CNTL-C to Quit`)
    console.log(`To Test`)
    console.log(`http://localhost:3000/user_login.html`)
    console.log(`http://localhost:3000/trainer_login.html`)
    console.log(`http://localhost:3000/admin_login.html`)

})

function validateUserGoals(goals) {

    if ( (utilities.isNumeric(goals.weight_goal) === false) &&
         (utilities.isDecimal(goals.weight_goal) === false) ) {

        return false

    }

    if ( utilities.isNumeric(goals.daily_exercise_minutes) === false ) {

        return false

    }

    if ( utilities.isNumeric(goals.daily_caloric_intake) === false ) {

        return false

    }

    if ( goals.exercise_days.length === 0 ) {

        return false

    }

    if ( (goals.weight_goal <= 0) || (goals.daily_exercise_minutes <= 0) || (goals.daily_caloric_intake <= 0) ) {

        return false

    }

    return true

}

function validateUserAttribute( user_attribute ) {

    if ( (user_attribute === "") || (user_attribute === null) || (user_attribute === undefined) ) {

        return false

    }

    return true

}
