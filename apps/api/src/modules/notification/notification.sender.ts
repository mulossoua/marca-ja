import type { Notification } from "@app/database";

// Camada de envio desacoplada (regra 21/27): a arquitectura já modela push/email/SMS/
// WhatsApp no schema (NotificationChannel), mas nenhuma credencial de gateway real
// existe neste ambiente. Por isso o único "sender" implementado regista a intenção
// de envio nos logs — trocar por um sender real (FCM, SES, Twilio…) não deve exigir
// alterar nenhum chamador, só esta função.
export interface NotificationSender {
  send(notification: Notification): Promise<void>;
}

export const consoleNotificationSender: NotificationSender = {
  async send(notification) {
    console.log(
      `[notificação:${notification.channel}] utilizador=${notification.userId} tipo=${notification.type} — ${notification.title}: ${notification.body}`,
    );
  },
};
