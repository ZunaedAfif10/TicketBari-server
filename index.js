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
    const userCollection = database.collection("user");


    app.get('/api/users', async (req, res) => {
      const cursor = userCollection.find();
      const users = await cursor.toArray();

      res.send(users)
    })


    app.get('/api/tickets', async (req, res) => {
      if (req.query.email) {
        const email = req.query.email;
        // console.log(req.query.email)
        const query = {
          vendorEmail: email
        }
        const cursor = await ticketCollection.find(query);
        const tickets = await cursor.toArray();
        // console.log(cursor)
        res.send(tickets);
      }
      else {
        const cursor = ticketCollection.find();
        const tickets = await cursor.toArray();
        // console.log(companies);
        res.send(tickets)
      }
    })


    app.get('/api/tickets/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const cursor = await ticketCollection.findOne(query);
      res.send(cursor);
    })


    app.post('/api/tickets', async (req, res) => {
      const ticketBody = req.body;
      // console.log(ticket);
      const ticket = {
        ...ticketBody,
        createdAt: new Date()
      }
      // console.log(ticket)
      const result = await ticketCollection.insertOne(ticket);
      res.send(result);
    })

    app.patch('/api/tickets/:id', async (req, res) => {
      const id = req.params.id;
      const updatedTicket = req.body;
      // console.log(updatedTicket)
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: updatedTicket.status
        }
      }
      const result = await ticketCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.get('/api/bookings', async (req, res) => {
      try {
        const { userId, vendorEmail } = req.query;

        if (!userId && !vendorEmail) {
          return res.status(400).json({ error: "Missing identity filter parameters." });
        }

        const matchStage = {};

        if (userId && userId !== "undefined") {
          matchStage.userId = userId;
        }

        const pipeline = [

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

        ];

        if (vendorEmail && vendorEmail !== "undefined") {
          pipeline.push({
            $match: { "ticketId.vendorEmail": vendorEmail }
          });
        }

        const bookings = await bookingCollection.aggregate(pipeline).toArray();
        res.json(bookings);

      } catch (error) {
        console.error("Aggregation pipeline breakdown:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post('/api/bookings', async (req, res) => {
      const book = req.body;
      // console.log(book);
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