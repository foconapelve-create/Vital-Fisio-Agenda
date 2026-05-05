const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

function getBaseUrl() {
  return `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export async function sendWhatsAppText(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    return { success: false, error: "Z-API não configurada (variáveis de ambiente ausentes)" };
  }

  const formattedPhone = formatPhone(phone);

  try {
    const res = await fetch(`${getBaseUrl()}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": ZAPI_CLIENT_TOKEN,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message,
      }),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Erro ao enviar mensagem" };
  }
}

export async function checkZapiStatus(): Promise<{ connected: boolean; error?: string }> {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    return { connected: false, error: "Credenciais Z-API não configuradas" };
  }

  try {
    const res = await fetch(`${getBaseUrl()}/status`, {
      headers: { "Client-Token": ZAPI_CLIENT_TOKEN },
    });
    const data = await res.json() as any;
    const connected = data?.connected === true || data?.status === "CONNECTED";
    return { connected, error: connected ? undefined : (data?.message || "WhatsApp desconectado") };
  } catch (e: any) {
    return { connected: false, error: e.message };
  }
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function buildReminderMessage(params: {
  patientName: string;
  therapistName: string;
  date: string;
  time: string;
  confirmLink: string;
  clinicName?: string;
  template?: string;
}): string {
  const { patientName, therapistName, date, time, confirmLink, clinicName = "VitalFisio", template } = params;

  const tpl = template ?? `Olá, {nome}! 👋

Sua sessão de fisioterapia está marcada para *{data}* às *{hora}* com *{terapeuta}*.

Por favor, confirme ou cancele sua presença neste link:
{link}

Obrigado! — {clinica}`;

  return renderTemplate(tpl, {
    nome: patientName,
    terapeuta: therapistName,
    data: formatDate(date),
    hora: time,
    link: confirmLink,
    clinica: clinicName,
  });
}

export function buildSecondReminderMessage(params: {
  patientName: string;
  therapistName: string;
  date: string;
  time: string;
  confirmLink: string;
  clinicName?: string;
  template?: string;
}): string {
  const { patientName, therapistName, date, time, confirmLink, clinicName = "VitalFisio", template } = params;

  const tpl = template ?? `⚠️ *Lembrete importante*, {nome}!

Ainda não recebemos sua confirmação para a sessão de *{data}* às *{hora}* com *{terapeuta}*.

Sua vaga pode ser liberada se não confirmar. Por favor, confirme agora:
{link}

— {clinica}`;

  return renderTemplate(tpl, {
    nome: patientName,
    terapeuta: therapistName,
    data: formatDate(date),
    hora: time,
    link: confirmLink,
    clinica: clinicName,
  });
}
