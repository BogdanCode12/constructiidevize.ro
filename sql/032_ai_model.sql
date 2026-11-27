-- Modelul asistentului se alege din admin (setarea ai_model); costul se calculează pe modelul fiecărei cereri.
ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS model VARCHAR(60) NULL AFTER status;
