DROP FUNCTION IF EXISTS encrypt_fan_fin(text, text);
DROP FUNCTION IF EXISTS verify_fan_fin(text, text, text);

CREATE OR REPLACE FUNCTION encrypt_fan_fin(
  plaintext_value text,
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
  RETURN encode(
    pgp_sym_encrypt(plaintext_value, encryption_key),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION verify_fan_fin(
  plaintext_value text,
  encrypted_value text,
  encryption_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_catalog
AS $$
DECLARE
  decrypted text;
BEGIN
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN false;
  END IF;
  BEGIN
    decrypted := pgp_sym_decrypt(
      decode(encrypted_value, 'base64'),
      encryption_key
    );
    RETURN decrypted = plaintext_value;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
END;
$$;