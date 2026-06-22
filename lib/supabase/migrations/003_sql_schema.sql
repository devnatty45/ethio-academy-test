-- Decrypt function needed for TOTP secret retrieval
CREATE OR REPLACE FUNCTION decrypt_totp_secret(
  encrypted_value text,
  encryption_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_catalog
AS $$
BEGIN
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not provided';
  END IF;
  RETURN pgp_sym_decrypt(
    decode(encrypted_value, 'base64'),
    encryption_key
  );
END;
$$;