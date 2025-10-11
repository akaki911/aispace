
export async function ensureWebAuthnReady(): Promise<void> {
  if (typeof window === 'undefined') throw new Error('WebAuthn requires browser');
  if (!('PublicKeyCredential' in window)) {
    throw new Error('WebAuthn not supported in this browser');
  }
  // Optional checks — უკეთესი მესიჯინგი
  const platformAvail = await (window.PublicKeyCredential as any)
    .isUserVerifyingPlatformAuthenticatorAvailable?.()
    .catch(() => false);
  if (!platformAvail) {
    // მუშაობს ändå უსაფრთხოების ფიზიკური გასაღებით, მაგრამ შეგვატყობინებინეთ UI-ში
    console.warn('No platform authenticator (TouchID/FaceID/Windows Hello)');
  }
}
