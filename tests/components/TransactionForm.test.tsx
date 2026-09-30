import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionForm } from "../../src/components/TransactionForm";

describe("transaction model and color selection", () => {
  it("filters models, shows that model's colors, and clears an invalid color after switching", async () => {
    const user = userEvent.setup();
    render(<TransactionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choisir un modèle d’iphone/i }));
    const picker = screen.getByRole("dialog", { name: /choisir un modèle d’iphone/i });
    await user.type(within(picker).getByRole("searchbox", { name: /rechercher des modèles/i }), "14 pro");
    await user.click(within(picker).getByRole("button", { name: "iPhone 14 Pro" }));

    const deepPurple = screen.getByRole("button", { name: "Deep Purple" });
    expect(deepPurple).toHaveAttribute("aria-pressed", "false");
    await user.click(deepPurple);
    expect(deepPurple).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Coral" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /modifier le modèle d’iphone/i }));
    const nextPicker = screen.getByRole("dialog", { name: /choisir un modèle d’iphone/i });
    await user.clear(within(nextPicker).getByRole("searchbox", { name: /rechercher des modèles/i }));
    await user.type(within(nextPicker).getByRole("searchbox", { name: /rechercher des modèles/i }), "15 pro max");
    await user.click(within(nextPicker).getByRole("button", { name: "iPhone 15 Pro Max" }));

    expect(screen.queryByRole("button", { name: "Deep Purple" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Natural Titanium" })).toHaveAttribute("aria-pressed", "false");
  });

  it("exposes price, date, notes, and the correct ID role as accessible names", async () => {
    const user = userEvent.setup();
    render(<TransactionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "Prix" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Pièce d’identité du vendeur — recto")).toBeInTheDocument();
    expect(screen.getByLabelText("Pièce d’identité du vendeur — verso")).toBeInTheDocument();

    await user.click(screen.getByText("Vente"));
    expect(screen.getByLabelText("Pièce d’identité de l’acheteur — recto")).toBeInTheDocument();
    expect(screen.getByLabelText("Pièce d’identité de l’acheteur — verso")).toBeInTheDocument();

    await user.click(screen.getByText("Plus de détails"));
    expect(screen.getByRole("textbox", { name: "Remarques" })).toBeInTheDocument();
  });

  it("clears seller ID images when changing a buy into a sale", async () => {
    const user = userEvent.setup();
    class LoadedImage {
      naturalWidth = 1;
      naturalHeight = 1;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    }
    vi.stubGlobal("Image", LoadedImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback(new Blob(["image"], { type: type ?? "image/jpeg" }));
    });
    render(<TransactionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await user.upload(screen.getByLabelText("Pièce d’identité du vendeur — recto"), new File(["front"], "front.png", { type: "image/png" }));
    expect(await screen.findByRole("img", { name: "Pièce d’identité du vendeur — recto — aperçu" })).toBeInTheDocument();

    await user.click(screen.getByText("Vente"));
    expect(screen.queryByRole("img", { name: "Pièce d’identité de l’acheteur — recto — aperçu" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Pièce d’identité de l’acheteur — recto")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
