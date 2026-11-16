// Доступ к камере вынесен отдельно: на iOS Safari getUserMedia обязан
// вызываться синхронно из обработчика пользовательского жеста.

const CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: false
}

export function requestCamera() {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null

  if (!md || typeof md.getUserMedia !== 'function') {
    return Promise.reject(
      new DOMException('getUserMedia is not supported', 'NotSupportedError')
    )
  }

  try {
    return md.getUserMedia(CONSTRAINTS)
  } catch (err) {
    return Promise.reject(err)
  }
}

export function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop())
}

export function describeCameraError(err) {
  const secure = typeof isSecureContext !== 'undefined' ? isSecureContext : true

  switch (err && err.name) {
    case 'NotSupportedError':
      return 'Браузер не поддерживает доступ к камере. Нажмите «Подтвердить QR».'
    case 'NotAllowedError':
    case 'SecurityError':
      return secure
        ? 'Доступ к камере запрещён. Разрешите его и нажмите «Включить камеру».'
        : 'iOS запрещает камеру по http://. Откройте адрес по https:// и нажмите «Включить камеру».'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'Подходящая камера не найдена. Нажмите «Подтвердить QR».'
    case 'NotReadableError':
      return 'Камера занята другим приложением. Закройте его и нажмите «Включить камеру».'
    default:
      return 'Не удалось включить камеру. Нажмите «Включить камеру» или «Подтвердить QR».'
  }
}
