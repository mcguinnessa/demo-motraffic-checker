const db_tools = require('./mongo_tools');
const {MongoClient} = require('mongodb');

const DAY_S = 24 * 60 * 60;
const DAY_MS = DAY_S * 1000;
const HOUR_MS = 60 * 60 * 1000;
const INTERVAL_S = 60 * 60;
const INTERVAL_MS = INTERVAL_S * 1000;

const max_traffic = 3000000;
const min_traffic = 2000;

//nst hourly_weighting = [1, 2, 3, 4, 5, 6, 7, 8, 9 10, 11, 12, 13, 14 ,15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
const hourly_weighting = [1, 2, 1, 1, 1, 1, 2, 2, 5,  7,  8,  9, 10, 10, 10,  9,  7,  5,  5,  5,  5,  3,  2,  1]


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getValue(a_timestamp){
  var record_hour = a_timestamp.getHours();
  weighting = hourly_weighting[record_hour % 24];

  const ceiling = (max_traffic / 10) * weighting;
  var mo_traffic = min_traffic + Math.floor(Math.random() * ceiling);

  console.log("TIME:" + a_timestamp + " HOUR:" + record_hour + " WEIGHTING:" + weighting + " CEILING:" + ceiling + " MO Traffic:" + mo_traffic);
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
