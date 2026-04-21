import { describe, it, expect } from "vitest";

// Testamos el reducer directamente, sin montar el componente React
// (lógica pura — no necesita DOM)

type KeypadState = { display: string; hasDecimal: boolean };
type KeypadAction =
  | { type: "DIGIT"; key: string }
  | { type: "DECIMAL" }
  | { type: "BACKSPACE" }
  | { type: "CLEAR" };

const MAX_INTEGER_DIGITS = 4;
const MAX_DECIMAL_DIGITS = 1;

function keypadReducer(state: KeypadState, action: KeypadAction): KeypadState {
  switch (action.type) {
    case "DIGIT": {
      if (state.display === "0" && action.key !== "0") {
        return { ...state, display: action.key };
      }
      const [intPart, decPart = ""] = state.display.split(".");
      if (state.hasDecimal) {
        if (decPart.length >= MAX_DECIMAL_DIGITS) return state;
        return { ...state, display: `${intPart}.${decPart}${action.key}` };
      }
      if (intPart.length >= MAX_INTEGER_DIGITS) return state;
      return { ...state, display: state.display + action.key };
    }
    case "DECIMAL":
      if (state.hasDecimal) return state;
      return { display: state.display + ".", hasDecimal: true };
    case "BACKSPACE": {
      if (state.display.length <= 1) return { display: "0", hasDecimal: false };
      const next = state.display.slice(0, -1);
      return { display: next, hasDecimal: next.includes(".") };
    }
    case "CLEAR":
      return { display: "0", hasDecimal: false };
  }
}

const initial: KeypadState = { display: "0", hasDecimal: false };
const reduce = (state: KeypadState, ...actions: KeypadAction[]) =>
  actions.reduce(keypadReducer, state);

describe("NumericKeypad reducer", () => {
  it("inicia en 0", () => {
    expect(initial.display).toBe("0");
  });

  it("reemplaza el 0 inicial al presionar un dígito", () => {
    expect(reduce(initial, { type: "DIGIT", key: "5" }).display).toBe("5");
  });

  it("acumula dígitos correctamente", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "1" },
      { type: "DIGIT", key: "2" },
      { type: "DIGIT", key: "3" },
    );
    expect(state.display).toBe("123");
  });

  it("limita la parte entera a 4 dígitos", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "1" },
      { type: "DIGIT", key: "2" },
      { type: "DIGIT", key: "3" },
      { type: "DIGIT", key: "4" },
      { type: "DIGIT", key: "5" }, // debe ignorarse
    );
    expect(state.display).toBe("1234");
  });

  it("añade decimal y limita a 1 dígito decimal", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "5" },
      { type: "DECIMAL" },
      { type: "DIGIT", key: "3" },
      { type: "DIGIT", key: "9" }, // debe ignorarse
    );
    expect(state.display).toBe("5.3");
  });

  it("no añade segundo punto decimal", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "5" },
      { type: "DECIMAL" },
      { type: "DECIMAL" }, // debe ignorarse
    );
    expect(state.display).toBe("5.");
    expect(state.hasDecimal).toBe(true);
  });

  it("BACKSPACE borra el último carácter", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "1" },
      { type: "DIGIT", key: "2" },
      { type: "BACKSPACE" },
    );
    expect(state.display).toBe("1");
  });

  it("BACKSPACE en display de 1 char vuelve a '0'", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "5" },
      { type: "BACKSPACE" },
    );
    expect(state.display).toBe("0");
    expect(state.hasDecimal).toBe(false);
  });

  it("BACKSPACE elimina el punto y resetea hasDecimal", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "5" },
      { type: "DECIMAL" },
      { type: "BACKSPACE" },
    );
    expect(state.hasDecimal).toBe(false);
    expect(state.display).toBe("5");
  });

  it("CLEAR vuelve al estado inicial", () => {
    const state = reduce(initial,
      { type: "DIGIT", key: "9" },
      { type: "DIGIT", key: "9" },
      { type: "CLEAR" },
    );
    expect(state.display).toBe("0");
    expect(state.hasDecimal).toBe(false);
  });
});
