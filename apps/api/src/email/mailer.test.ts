import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "../config";
import { isEmailDeliveryConfigured, parseFromAddress, sendEmail } from "./mailer";

describe("parseFromAddress", () => {
  it("parsea Nombre <email>", () => {
    expect(parseFromAddress("Farmacovigilancia MSP <sender@example.com>")).toEqual({
      name: "Farmacovigilancia MSP",
      email: "sender@example.com",
    });
  });

  it("acepta un email suelto", () => {
    expect(parseFromAddress("solo@example.com")).toEqual({
      email: "solo@example.com",
    });
  });
});

describe("sendEmail", () => {
  const originalBrevo = config.BREVO_API_KEY;
  const originalFrom = config.EMAIL_FROM;

  afterEach(() => {
    config.BREVO_API_KEY = originalBrevo;
    config.EMAIL_FROM = originalFrom;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("con API key llama a Brevo por HTTP", async () => {
    config.BREVO_API_KEY = "xkeysib-test";
    config.EMAIL_FROM = "Farmacovigilancia MSP <sender@example.com>";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendEmail({
      to: "destino@example.com",
      subject: "Prueba",
      text: "hola",
      html: "<p>hola</p>",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");

    const body = JSON.parse(String(init.body)) as {
      sender: { name: string; email: string };
      to: { email: string }[];
      subject: string;
    };
    expect(body.sender).toEqual({
      name: "Farmacovigilancia MSP",
      email: "sender@example.com",
    });
    expect(body.to).toEqual([{ email: "destino@example.com" }]);
    expect(body.subject).toBe("Prueba");
    expect(isEmailDeliveryConfigured()).toBe(true);
  });

  it("si Brevo falla, propaga el código de respuesta", async () => {
    config.BREVO_API_KEY = "xkeysib-test";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unrecognised IP address",
      }),
    );

    await expect(
      sendEmail({
        to: "destino@example.com",
        subject: "Prueba",
        text: "hola",
        html: "<p>hola</p>",
      }),
    ).rejects.toThrow(/Brevo respondió 401/);
  });

  it("sin API key escribe el mail en el log", async () => {
    config.BREVO_API_KEY = undefined;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await sendEmail({
      to: "destino@example.com",
      subject: "Solo log",
      text: "enlace http://localhost/reset",
      html: "<p>enlace</p>",
    });

    expect(info).toHaveBeenCalled();
    const logged = String(info.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("destino@example.com");
    expect(logged).toContain("enlace http://localhost/reset");
    expect(isEmailDeliveryConfigured()).toBe(false);
  });
});
