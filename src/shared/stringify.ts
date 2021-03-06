const ignoreKeys = ['rootStore']

const getCircularReplacer = () => {
  const seen = new WeakSet()

  return (key, value) => {
    if (ignoreKeys.includes(key)) {
      return
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return
      }
      seen.add(value)
    }
    return value
  }
}

export const stringify = (obj, spacing = 2) => {
  return JSON.stringify(obj, getCircularReplacer(), spacing)
}
