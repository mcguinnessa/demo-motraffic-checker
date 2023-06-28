const db_tools = require('./mongo_tools');
const {MongoClient} = require('mongodb');

const DAY_S = 24 * 60 * 60;
const DAY_MS = DAY_S * 1000;
const HOUR_MS = 60 * 60 * 1000;
const INTERVAL_S = 60 * 60;
const INTERVAL_MS = INTERVAL_S * 1000;

const max_traffic = 3000000;
const min_traffic = 2000;
const min_variance = -2;
const max_variance = 2;


const weekday_weighting = [ 8, 6, 2, 1, 2, 16, 32, 36, 40, 35, 52, 62, 72, 64, 72, 73, 76, 79, 80, 77, 60, 52, 24, 16]
const fri_weighting =     [10,  6, 2, 1, 3, 20, 40, 45, 50, 43, 64, 77, 90, 80, 90, 92, 95, 99, 100, 95, 96, 86, 83, 54]
const sat_weighting =     [20, 12, 7, 1, 3, 20, 40, 45, 50, 43, 64, 77, 90, 80, 90, 92, 95, 99, 100, 95, 97, 87, 80, 60]
const sun_weighting =     [20, 12, 7, 1, 3, 20, 40, 45, 50, 43, 64, 77, 90, 80, 90, 92, 80, 85, 87, 77, 60, 54, 23, 14]

const weekly_weighting = [sun_weighting, weekday_weighting, weekday_weighting, weekday_weighting, weekday_weighting, fri_weighting, sat_weighting]


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getValue(a_timestamp){
  var record_day = a_timestamp.getDay();
  const day = weekly_weighting[record_day]

  var record_hour = a_timestamp.getHours();
  const weighting = day[record_hour];

  const variance = (Math.random() * (max_variance - min_variance) + min_variance)

  mo_traffic = min_traffic +(((max_traffic - min_traffic) / 100) * (weighting + variance));

  if (mo_traffic < min_traffic){ mo_traffic = min_traffic}

  console.log("TIME:" + a_timestamp + " DAY:" + record_day + " HOUR:" + record_hour + " WEIGHTING:" + weighting + " VARIANCE:" + variance + " MT Traffic:" + mo_traffic);
  return mo_traffic;
}

async function run(){

  const uri = await db_tools.get_url();
  console.log("URI");
  console.log(uri);
  const client = new MongoClient(uri);

  try {
    const database = client.db(db_tools.DB_NAME);
    const metric_record = database.collection(db_tools.COLLECTION_NAME);
    var now = new Date();

//    metric_record.deleteMany({"$and": [{timestamp: {"$lt": now }}, { "moTraffic": {$exists : true } }]} , (err, d_res) => {
//      if (err) throw err;
//      console.log("Delete:" + d_res.deleteCount);
//    })
    const d_res = await metric_record.deleteMany({"$and": [{timestamp: {"$lt": now }}, { "moTraffic": {$exists : true } }]} )
    console.log("Delete:" + d_res.deletedCount);

//    var yesterday = new Date(now - DAY_MS);
//    var date_record = yesterday;
//    console.log("Yesterday:" + yesterday)

    var last_week = new Date(now - (DAY_MS * 7));
    var date_record = last_week;
    console.log("Last Week:" + last_week)


    while (date_record <= now){

      mo_traffic = await getValue(date_record); 

      const doc = {
        timestamp: date_record,
        "moTraffic": mo_traffic,
      }  

      const result = await metric_record.insertOne(doc);
      //console.log(`A document was inserted with the _id: ${result.insertedId}` + " CPU Temp:" + cpu_temp);
      //date_record = new Date(date_record.getTime() + INTERVAL_MS);
	    
      date_record = new Date(date_record.getTime() + INTERVAL_MS);
      //date_record.setMinutes(date_record.getMinutes() + 10);
      //console.log("DATE:" + date_record)
    }

    while (true) {
       console.log("Sleeping for " + INTERVAL_MS)
       await sleep(INTERVAL_MS);
       var right_now = new Date();
       mo_traffic = await getValue(right_now);
       const doc = {
         timestamp: right_now,
         "moTraffic": mo_traffic,
       }  

       const result = await metric_record.insertOne(doc);
       console.log(`A document was inserted with the _id: ${result.insertedId}` + " MO Traffic:" + mo_traffic);
    }

  } finally {
    await client.close();
  }
}
run().catch(console.dir);
