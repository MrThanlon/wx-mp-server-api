export type Credential = {
  appid: string
  secret: string
}

export type Method = "GET" | "POST"

export type Error = {
  errmsg: string
  errcode: number
}

export type EnvVersion = "release" | "trial" | "develop"

export function createClient(credential: Credential) {
  return {
    async code2Session(params: Credential & { js_code: string }): Promise<{
      session_key: string
      unionid: string
      openid: string
    } & Error> {
      return await getJson<{
        session_key: string
        unionid: string
        errmsg: string
        openid: string
        errcode: number
      }>("https://api.weixin.qq.com/sns/jscode2session", { ...params, grant_type: "authorization_code" })
    },
    getUnlimitedQRCode: rawResponse<{
      scene: string
      page?: string
      check_path?: boolean
      env_version?: EnvVersion
      width?: number
      auto_color?: boolean
      line_color?: {
        r: number
        g: number
        b: number
      }
      is_hyaline?: boolean
    }>(credential, "https://api.weixin.qq.com/wxa/getwxacodeunlimit", "POST"),
    generateScheme: jsonResponse<{
      jump_wxa?: {
        path?: string
        query?: string
        env_version?: EnvVersion
      }
      expire_time?: number
      expire_type?: number
      expire_interval?: number
    }, {
      openlink: string
    }>(credential, "https://api.weixin.qq.com/wxa/generatescheme", "POST"),
  }
}

export async function getStableAccessToken(credential: Credential, force_refresh: boolean = false) {
  const grant_type = "client_credential"
  return (await postJson<{}, { access_token: string }>(
    "https://api.weixin.qq.com/cgi-bin/stable_token",
    { grant_type, appid: credential.appid, secret: credential.secret, force_refresh }
  )).access_token
}

async function postJson<P, R>(url: string, params: P): Promise<R> {
  return (await post(url, params)).json()
}

async function post<P>(url: string, params: P): Promise<Response> {
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  })
}

async function get(url: string, params: string[][] | Record<string, string> | string | URLSearchParams): Promise<Response> {
  url += "?" + new URLSearchParams(params).toString()
  return await fetch(url)
}

async function getJson<R>(url: string, params: string[][] | Record<string, string> | string | URLSearchParams): Promise<R> {
  return (await get(url, params)).json()
}

function jsonResponse<P, R>(credential: Credential, url: string, method: Method): (params: P) => Promise<R & Error> {
  if (method === "GET") {
    return async (params: P) => {
      const access_token = await getStableAccessToken(credential)
      const res = await getJson<R & Error>(url, { ...params, access_token })
      return res
    }
  } else {
    return async (params: P) => {
      const token = await getStableAccessToken(credential)
      const res = await postJson<P, R & Error>(url + `?access_token=${token}`, params)
      return res
    }
  }
}

function rawResponse<P>(credential: Credential, url: string, method: Method) {
  if (method === "GET") {
    return async (params: P) => {
      const access_token = await getStableAccessToken(credential)
      return await get(url, { ...params, access_token })
    }
  } else {
    return async (params: P) => {
      const token = await getStableAccessToken(credential)
      return await post<P>(url + `?access_token=${token}`, params)
    }
  }
}
