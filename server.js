const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SDP_URL = process.env.SDP_URL;
const SDP_API_KEY = process.env.SDP_API_KEY;

const WASENDER_API_KEY = process.env.WASENDER_API_KEY;
const INSTANCE_ID = process.env.INSTANCE_ID;


// enviar mensaje whatsapp
async function sendWhatsApp(to, message) {

    await axios.post(
        `https://api.wasenderapi.com/instances/${INSTANCE_ID}/messages/send`,
        {
            to: to,
            message: message
        },
        {
            headers: {
                Authorization: `Bearer ${WASENDER_API_KEY}`,
                "Content-Type": "application/json"
            }
        }
    );
}


// crear ticket
async function createTicket(description) {

    const response = await axios.post(
        `${SDP_URL}/requests`,
        {
            request: {
                subject: "Ticket desde WhatsApp",
                description: description
            }
        },
        {
            headers: {
                authtoken: SDP_API_KEY,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data.request.id;
}


// consultar ticket
async function getTicket(id) {

    const response = await axios.get(
        `${SDP_URL}/requests/${id}`,
        {
            headers: {
                authtoken: SDP_API_KEY
            }
        }
    );

    return response.data.request.status.name;
}


// webhook
app.post("/webhook", async (req, res) => {
    console.log("WEBHOOK ACTIVADO");
    console.log(JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
});

});

app.listen(PORT, () =>
    console.log(`Servidor activo en puerto ${PORT}`));
