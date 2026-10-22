export function interviewMessage(name: string, jobTitle: string) {
  return `Hi ${name}, thanks for applying for the ${jobTitle} job. Can you come for a short interview? Please reply with a time that suits you.`;
}

// Click-to-chat link: opens WhatsApp with the message already typed. `phone` is 91XXXXXXXXXX.
export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
