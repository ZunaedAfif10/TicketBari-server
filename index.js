const express = require('express');
const app = express()
const port = 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
})

require('dotenv').config();
const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("ticketbari");
    const ticketCollection = database.collection("tickets");
    const bookingCollection = database.collection("bookings");


    app.get('/api/tickets', async (req, res) => {
      const cursor = ticketCollection.find();
      const companies = await cursor.toArray();
      // console.log(companies);
      res.send(companies)
    })


    app.get('/api/tickets/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const cursor = await ticketCollection.findOne(query);
      res.send(cursor);
    })

    app.get('/api/bookings', async (req, res) => {
      const matchStage = {};
      if (req.query.userId && req.query.userId !== "undefined") {
        matchStage.userId = req.query.userId;
      }

      const bookings = await bookingCollection.aggregate([
        { $match: matchStage },

        {
          $addFields: {
            ticketId: { $toObjectId: "$ticketId" }
          }
        },

        {
          $lookup: {
            from: "tickets",
            localField: "ticketId",
            foreignField: "_id",
            as: "ticketId"
          }
        },

        { $unwind: "$ticketId" }
      ]).toArray();

      res.json(bookings);
    })

    app.post('/api/bookings', async (req, res) => {
      const book = req.body;
      console.log(book);
      const booking = {
        ...book,
        createdAt: new Date()
      }
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})