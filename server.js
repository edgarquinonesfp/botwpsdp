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

// =============================
// SESIONES EN MEMORIA
// =============================
const sesiones = {};

// =============================
// ENVIAR MENSAJE WHATSAPP
// =============================
async function sendWhatsApp(to, message) {
    try {

        // convertir 59167378077@s.whatsapp.net → +59167378077
        const numeroLimpio = to.replace("@s.whatsapp.net", "");

        const response = await axios.post(
            "https://www.wasenderapi.com/api/send-message",
            {
                to: `+${numeroLimpio}`,
                text: message
            },
            {
                headers: {
                    Authorization: `Bearer ${WASENDER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Mensaje enviado:", response.data);

    } catch (error) {

        if (error.response) {
            console.log("ERROR WASENDER STATUS:", error.response.status);
            console.log("ERROR WASENDER DATA:", error.response.data);
        } else {
            console.log("ERROR WASENDER:", error.message);
        }

    }
}

// =============================
// VALIDAR USUARIO EN SDP
// =============================
async function validarUsuarioEnSDP(login) {
    try {
        const searchCriteria = {
            field: "login_name",
            condition: "is",
            value: login
        };

        const response = await axios.get(
            `${SDP_URL}/api/v3/requesters`,
            {
                params: {
                    search_criteria: JSON.stringify(searchCriteria)
                },
                headers: {
                    authtoken: SDP_API_KEY
                }
            }
        );

        return response.data.requesters?.length > 0;

    } catch (error) {
        console.error("Error validando usuario:", error.response?.data || error.message);
        return false;
    }
}

// =============================
// CREAR TICKET
// =============================
async function crearTicket(descripcion, numero) {
    try {

        const login = sesiones[numero].login;

        const inputData = {
            request: {
                subject: "Ticket desde WhatsApp",
                description: descripcion,
                requester: {
                    login_name: login
                }
            }
        };

        const response = await axios.post(
            `${SDP_URL}/api/v3/requests`,
            new URLSearchParams({
                input_data: JSON.stringify(inputData)
            }),
            {
                headers: {
                    authtoken: SDP_API_KEY,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        return response.data;

    } catch (error) {
        if (error.response) {
            console.log("STATUS:", error.response.status);
            console.log("DATA:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.log("ERROR:", error.message);
        }
        return null;
    }
}

// =============================
// CONSULTAR ESTADO TICKET
// =============================
async function consultarEstado(id) {
    try {
        const response = await axios.get(
            `${SDP_URL}/api/v3/requests/${id}`,
            {
                headers: {
                    authtoken: SDP_API_KEY
                }
            }
        );

        return response.data.request.status.name;

    } catch (error) {
        console.error("Error consultando ticket:", error.response?.data || error.message);
        return null;
    }
}

// =============================
// WEBHOOK
// =============================
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

        if (!mensaje) return res.sendStatus(200);

        // =============================
        // LOGIN
        // =============================
        if (mensaje === "login") {
            sesiones[numero] = { paso: "esperando_usuario" };
            await sendWhatsApp(numero, "Ingresa tu usuario de ServiceDesk:");
            return res.sendStatus(200);
        }

        if (sesiones[numero]?.paso === "esperando_usuario") {

            const login = mensaje.trim();
            const existe = await validarUsuarioEnSDP(login);

            if (existe) {
                sesiones[numero] = {
                    autenticado: true,
                    login: login
                };

                await sendWhatsApp(numero, "✅ Autenticación exitosa.");
            } else {
                delete sesiones[numero];
                await sendWhatsApp(numero, "❌ Usuario no encontrado en ServiceDesk.");
            }

            return res.sendStatus(200);
        }

        // =============================
        // LOGOUT
        // =============================
        if (mensaje === "logout") {
            delete sesiones[numero];
            await sendWhatsApp(numero, "Has cerrado sesión correctamente.");
            return res.sendStatus(200);
        }

        // =============================
        // REQUIERE AUTENTICACIÓN
        // =============================
        if (!sesiones[numero]?.autenticado) {
            await sendWhatsApp(numero, "Debes iniciar sesión primero escribiendo: login");
            return res.sendStatus(200);
        }

        // =============================
        // CREAR TICKET
        // =============================
        if (mensaje.startsWith("crear ticket")) {

            await sendWhatsApp(numero, "Estamos creando tu ticket, por favor espera...");

            const resultado = await crearTicket(mensaje, numero);

            if (resultado) {
                const ticketId = resultado.request.id;

                await sendWhatsApp(
                    numero,
                    `✅ Ticket creado correctamente.\nNúmero de solicitud: ${ticketId}`
                );
            } else {
                await sendWhatsApp(numero, "❌ No se pudo crear el ticket.");
            }

            return res.sendStatus(200);
        }

        // =============================
        // CONSULTAR ESTADO
        // =============================
        if (mensaje.startsWith("estado")) {

            const partes = mensaje.split(" ");
            const id = partes[1];

            if (!id) {
                await sendWhatsApp(numero, "Debes indicar el número. Ejemplo: estado 1234");
                return res.sendStatus(200);
            }

            const estado = await consultarEstado(id);

            if (estado) {
                await sendWhatsApp(numero, `El estado del ticket ${id} es: ${estado}`);
            } else {
                await sendWhatsApp(numero, "No se pudo consultar el ticket.");
            }

            return res.sendStatus(200);
        }

        res.sendStatus(200);

    } catch (error) {
        console.error("ERROR WEBHOOK:", error.message);
        res.sendStatus(500);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});



