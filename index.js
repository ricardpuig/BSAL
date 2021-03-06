var request = require('request');
var mysql = require('mysql');
//var http = require('http');

//const express = require('express');
//const mongoose = require('mongoose');
//const bodyParser = require('body-parser');
//const app = express();

//mongoose.Promise = global.Promise;
//mongoose.connect('mongodb://localhost/broadsign', {
//  useMongoClient:true
//}).then(() => console.log('DB is connected'));

//settings
//app.set('port',process.env.PORT || 3000);
//app.set('views', path.join('./','views'));
//app.set('view engine', 'html');
//app.use(express.static(__dirname + '/views'));

//middelware
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({extended:false}))

//routes
//app.use(require('./routes/index'));
//static files
//app.listen(app.get('port'), () =>{
//console.log('server on port 3000');
//})

console.log("BROADSIGN MONITOR POLL");

var connection = mysql.createConnection({ host : '54.38.184.204', database : 'netmon', user : 'iwall', password : 'iwalldigitalsignage', });
connection.connect(function(err) {
if (err) {
  console.error('Error connecting: ' + err.stack);
  return;
}
console.log('Connected as id ' + connection.threadId); });


connection.query("DELETE FROM player_status");

var auth = "Bearer e03b2732ac76e3a954e4be0c280a04a3";
var url_player_status= 'https://api.broadsign.com:10889/rest/monitor_poll/v2?domain_id=17244398';
var url_host_by_id= 'https://api.broadsign.com:10889/rest/host/v14/by_id?domain_id=17244398';
var url_container_info= 'https://api.broadsign.com:10889/rest/container/v9/by_id?domain_id=17244398';
var broadsign_report = [];


//MATCH FUNCTIONS
function match(item, filter) {
  var keys = Object.keys(filter);
  // true if any true
  return keys.some(function (key) {
    return item[key] == filter[key];
  });
}

//WEB REQUEST OPTIONS
    var options = {
      url: url_player_status,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': auth
      }
    };


    //******* FIRST REQUEST - MONITOR POLL *************************
    request(options, (err, res, body) => {

    let json_mp= JSON.parse(body);
    var count_players = 0;
    var count_online = 0;
    var count_mia = 0;
    var online_players = [];
    var mia_players = [];
    var mias=[];

    for (i in json_mp.monitor_poll) {
        //missing in acti on players
        if(json_mp.monitor_poll[i].monitor_status != 4){
           count_players ++;  //inc counter
           if(json_mp.monitor_poll[i].monitor_status != 1){
              mia_players.push({'player_id' : json_mp.monitor_poll[i].client_resource_id,
                                   'last_seen' : json_mp.monitor_poll[i].poll_last_utc});
              mias.push(json_mp.monitor_poll[i].client_resource_id);
              count_mia ++;
           }
           if(json_mp.monitor_poll[i].monitor_status == 1){

              online_players.push({'player_id' : json_mp.monitor_poll[i].client_resource_id,
                                   'last_seen' : json_mp.monitor_poll[i].poll_last_utc});

              count_online ++;
           }
        }
    }
    console.log('TOTAL PLAYERS FOUND: ' + count_players);
    console.log('ONLINE PLAYERS: ' + count_online);
    console.log('OFFLINE PLAYERS: ' + count_mia);

    //*************************************************************************
    //*************SECOND REQUEST**********************************************

    //PREPARE SECOND REQUEST:
    url_host_by_id= url_host_by_id + '&ids=' + mias;

    //update url Request
    options.url=url_host_by_id;
    broadsign_report = [];

    request(options, (err, res, body) => {
      let json_hosts= JSON.parse(body);
      var con = [];  //array of containers
      for (j in json_hosts.host) {
        broadsign_report.push({'Container_id' : json_hosts.host[j].container_id,
                         'Screens':json_hosts.host[j].nscreens,
                         'Display_unit': json_hosts.host[j].display_unit_id,
                         'Name': json_hosts.host[j].name ,
                         'Folder' : '' }) ;
        con.push(json_hosts.host[j].container_id);
      }

      //**************************************************************
      //*************** THIRD REQUEST ********************************

      url_container_info= url_container_info + '&ids=' + con;
      options.url=url_container_info;

      request(options, (err, res, body) => {
        var resources = [];
        let json_containers= JSON.parse(body);

        for (k in json_containers.container) {
          for (var l = 0; l < broadsign_report.length; l++) {
            if (broadsign_report[l]['Container_id'] === json_containers.container[k].id) {
                broadsign_report[l]['Folder']=json_containers.container[k].name ;
                console.log("INSERT INTO player_status (player) VALUES (' "+ broadsign_report[l]['Name']+ "');");
                connection.query("INSERT INTO player_status (player,folder, display_unit, screens, container_id) VALUES (' "+ broadsign_report[l]['Name']+"','"+ broadsign_report[l]['Folder']+"','"+ broadsign_report[l]['Display_unit']+ "','"+  broadsign_report[l]['Screens']+ "','"+ broadsign_report[l]['Container_id'] +"');");
              }
          }
        }
        console.log(broadsign_report)


        connection.end();



      });
    });
});
