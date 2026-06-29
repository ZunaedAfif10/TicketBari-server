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
        // await client.connect();

        const database = client.db("ticketbari");
        const ticketCollection = database.collection("tickets");
        const bookingCollection = database.collection("bookings");
        const userCollection = database.collection("user");
        const paymentCollection = database.collection("payments");
        const sellingCollection = database.collection("sellings");
        const sessionCollection = database.collection("session");


        const verifyToken = async (req, res, next) => {

            const authHeader = req.headers?.authorization;
            // console.log(authHeader)
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const token = authHeader.split(' ')[1]

            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const query = { token: token }
            const session = await sessionCollection.findOne(query);

            if (!session) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const userId = session.userId;


            const userQuery = {
                _id: userId
            }

            const user = await userCollection.findOne(userQuery);
            // console.log(user)
            if (!user) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            // set data in the req object
            req.user = user;
            next();
        }

        const verifyUser = async (req, res, next) => {
            if (req.user?.role !== 'user') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifyVendor = async (req, res, next) => {
            if (req.user?.role !== 'vendor') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifyAdmin = async (req, res, next) => {
            if (req.user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // users

        app.get('/api/users',verifyToken,verifyAdmin, async (req, res) => {
            const cursor = userCollection.find();
            const users = await cursor.toArray();

            res.send(users)
        })

        app.patch('/api/users/:id',verifyToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedUser = req.body;
            // console.log(updatedUser , id)

            const filter = { _id: new ObjectId(id) }
            if (updatedUser.role) {

                const updatedDoc = {
                    $set: {
                        role: updatedUser.role
                    }
                }

                const result = await userCollection.updateOne(filter, updatedDoc);
                // console.log(result)
                res.send(result);
            }
            else {
                const updatedDoc = {
                    $set: {
                        status: updatedUser.status
                    }
                }
                if (updatedUser.status === 'fraud') {
                    await ticketCollection.deleteMany({ vendorId: id });
                }

                const result = await userCollection.updateOne(filter, updatedDoc);
                // console.log(result)
                res.send(result);
            }
        })


        // advertise

        app.get('/api/advertise', async (req, res) => {
            const cursor = ticketCollection.find({ isAdvertised: true });
            const tickets = await cursor.toArray();
            // console.log(tickets)
            res.send(tickets)
        })

        app.patch('/api/advertise/:id',verifyToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedAdvertise = req.body;
            // console.log(updatedAdvertise);
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    isAdvertised: updatedAdvertise.isAdvertised
                }
            }
            const result = await ticketCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // tickets
        app.get('/api/latest-tickets', async (req, res) => {
            try {
                const cursor = ticketCollection.find().sort({ createdAt: -1 }).limit(8);

                const tickets = await cursor.toArray();
                res.send(tickets);
            } catch (error) {
                // console.error("Error fetching latest tickets:", error);
                res.status(500).send({ message: "Failed to retrieve latest tickets" });
            }
        });

        app.get('/api/tickets',verifyToken, async (req, res) => {
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

                res.send(tickets)
            }
        })

        app.get('/api/approved-tickets', async (req, res) => {
            const query = {
                status: 'approved'
            }
            const cursor = ticketCollection.find(query);
            const tickets = await cursor.toArray();

            res.send(tickets)
        })


        app.get('/api/tickets/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const cursor = await ticketCollection.findOne(query);
            res.send(cursor);
        })


        app.post('/api/tickets',verifyToken,verifyVendor, async (req, res) => {
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

        app.patch('/api/tickets/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const { _id, ...allowedUpdates } = req.body;
            // console.log(updatedTicket)
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    ...allowedUpdates
                }
            }
            const result = await ticketCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        app.delete('/api/tickets/:id',verifyToken,verifyVendor, async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) };
            const result = await ticketCollection.deleteOne(filter);
            res.send(result);
        });

        // bookings

        app.patch('/api/bookings/:id',verifyToken,verifyVendor, async (req, res) => {
            const id = req.params.id;
            const updatedBooking = req.body;

            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: updatedBooking.status
                }
            }
            const result = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })




        app.get('/api/bookings',verifyToken, async (req, res) => {
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
                // console.error("Aggregation pipeline breakdown:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        app.post('/api/bookings',verifyToken,verifyUser, async (req, res) => {
            const book = req.body;
            // console.log(book);
            const booking = {
                ...book,
                createdAt: new Date()
            }
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })


        // payments

        app.get('/api/sellings',verifyToken,verifyVendor, async (req, res) => {
            const email = req.query.email;
            // console.log(req.query.email)
            const query = {
                vendorEmail: email
            }
            const cursor = await sellingCollection.find(query);
            const selling = await cursor.toArray();
            // console.log(cursor)
            res.send(selling);
        })

        app.get('/api/payments',verifyToken,verifyUser, async (req, res) => {
            const email = req.query.email;
            // console.log(req.query.email)
            const query = {
                userEmail: email
            }
            const cursor = await paymentCollection.find(query);
            const payment = await cursor.toArray();
            // console.log(cursor)
            res.send(payment);
        })



        app.post('/api/payments',verifyToken,verifyUser, async (req, res) => {
            const { userId, amount, bookingId, ticketId, ticketTitle, vendorEmail, quantity, email, transactionId, paymentStatus } = req.body;
            // console.log(req.body);
            const sellingData = {
                ticketId: ticketId,
                ticketTitle: ticketTitle,
                attendeeEmail: email,
                vendorEmail: vendorEmail,
                quantity,
                amount,
                transactionId,
                paymentStatus,
                bookingDate: new Date(),
            };
            const isSellingExist = await sellingCollection.findOne({ transactionId });
            if (isSellingExist) {
                return res.status(200).send({ message: 'Already paid' });
            }
            const sellingRes = await sellingCollection.insertOne(sellingData);

            await ticketCollection.updateOne(
                { _id: new ObjectId(ticketId) },
                {
                    $inc: {
                        quantity: -quantity,
                    },
                }
            );
            // console.log(bookingId)
            await bookingCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                {
                    $set: {
                        status: 'paid',
                    },
                }
            );
            const paymentData = {
                userEmail: email,
                amount,
                ticketTitle,
                transactionId,
                paymentStatus,
                paidAt: new Date(),
            };
            // console.log(sellingData,paymentData)

            await paymentCollection.insertOne(paymentData);
            res.send(sellingRes);
        });


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
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