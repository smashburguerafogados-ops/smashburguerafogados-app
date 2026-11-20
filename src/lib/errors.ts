import type { FirebaseError } from 'firebase/app'

function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

/** Delivery and pickup forms have no password field, so never ask for one there. */
export function mapCustomerError(error: unknown): string {
  if (isFirebaseError(error) && error.code === 'auth/email-already-in-use') {
    return 'Não foi possível abrir seu cadastro. Fale com o atendimento pelo WhatsApp.'
  }
  const message = mapAuthError(error)
  if (message === 'WhatsApp ou senha incorretos.') return 'Não foi possível abrir seu cadastro. Tente de novo.'
  return message
}

export function mapAuthError(error: unknown): string {
  if (!isFirebaseError(error)) {
    return 'Não foi possível concluir. Tente de novo.'
  }

  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Este WhatsApp já está cadastrado. Entre com a senha.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'WhatsApp ou senha incorretos.'
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Espere um pouco e tente de novo.'
    case 'auth/network-request-failed':
      return 'Sem conexão. Tente de novo.'
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'O acesso por e-mail e senha ainda não está ativo no Firebase.'
    case 'permission-denied':
      return 'Não foi possível salvar o cadastro. Publique as regras do Firestore.'
    default:
      return 'Não foi possível concluir. Tente de novo.'
  }
}
