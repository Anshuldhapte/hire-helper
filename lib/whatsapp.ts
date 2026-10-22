// WhatsApp click-to-chat links: they open WhatsApp with a message already typed.
// The owner always presses Send themselves; nothing is sent automatically.

export function interviewMessage(name: string, roleTitle: string, interviewTime: string) {
  const greeting = name ? `Namaste ${name}!` : "Namaste!";
  const when = interviewTime.trim() || "this week";
  return `${greeting} Thank you for applying for the ${roleTitle} job. Can you come for a short interview ${when}? Please reply YES to confirm.`;
}

export function checkInMessage(name: string) {
  const greeting = name ? `Namaste ${name}` : "Namaste";
  return `${greeting}, how is your first week going? Reply 1 = all good, 2 = some problems, 3 = thinking of leaving.`;
}

// `phone` is the 10-digit Indian mobile number.
export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
}

// Lets the owner pick any contact or group to send the message to.
export function whatsappShareLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
