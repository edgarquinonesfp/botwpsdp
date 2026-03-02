const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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






// webhook
app.post("/webhook", async (req, res) => {
    try {

        const event = req.body.event;

        if (event !== "messages.received") {
            return res.sendStatus(200);
        }

        const mensaje = req.body.data?.messages?.messageBody?.toLowerCase();
        const numero = req.body.data?.messages?.remoteJid;

        console.log("Mensaje:", mensaje);
        console.log("Numero:", numero);

        if (!mensaje) {
            return res.sendStatus(200);
        }

        if (mensaje.includes("crear ticket")) {
            console.log("Crear ticket detectado");

        const resultado = await crearTicket(mensaje, numero);

        if (resultado) {
        console.log("Ticket creado correctamente");
    } else {
        console.log("No se pudo crear el ticket");
    }
}

        if (mensaje.includes("estado")) {
            console.log("Consultar estado detectado");
            // aquí va tu función consultarEstado(mensaje)
        }

        res.sendStatus(200);

    } catch (error) {
        console.error("ERROR WEBHOOK:", error.message);
        res.sendStatus(500);
    }
});

// crear ticket
async function crearTicket(descripcion, numero) {
    try {

        const inputData = {
            request: {
                subject: "Ticket desde WhatsApp",
                description: descripcion,
                requester: {
                    name: "administrator" // Debe existir en SDP
                }
            }
        };

        const response = await axios.post(
            `${process.env.SDP_URL}/api/v3/requests`,
            new URLSearchParams({
                input_data: JSON.stringify(inputData)
            }),
            {
                headers: {
                    "authtoken": process.env.SDP_API_KEY,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        console.log("Ticket creado:", response.data);
        return response.data;

    } catch (error) {
        console.error("ERROR CREANDO TICKET:", error.response?.data || error.message);
        return null;
    }
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



app.listen(PORT, () =>
    console.log(`Servidor activo en puerto ${PORT}`));
