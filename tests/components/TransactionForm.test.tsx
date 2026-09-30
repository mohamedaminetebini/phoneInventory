import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionForm } from "../../src/components/TransactionForm";

describe("transaction model and color selection", () => {
  it("filters models, shows that model's colors, and clears an invalid color after switching", async () => {
    const user = userEvent.setup();
    render(<TransactionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choose iphone model/i }));
    const picker = screen.getByRole("dialog", { name: /choose iphone model/i });
    await user.type(within(picker).getByRole("searchbox", { name: /search models/i }), "14 pro");
    await user.click(within(picker).getByRole("button", { name: "iPhone 14 Pro" }));

    const deepPurple = screen.getByRole("button", { name: "Deep Purple" });
    expect(deepPurple).toHaveAttribute("aria-pressed", "false");
    await user.click(deepPurple);
    expect(deepPurple).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Coral" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /change iphone model/i }));
    const nextPicker = screen.getByRole("dialog", { name: /choose iphone model/i });
    await user.clear(within(nextPicker).getByRole("searchbox", { name: /search models/i }));
    await user.type(within(nextPicker).getByRole("searchbox", { name: /search models/i }), "15 pro max");
    await user.click(within(nextPicker).getByRole("button", { name: "iPhone 15 Pro Max" }));

    expect(screen.queryByRole("button", { name: "Deep Purple" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Natural Titanium" })).toHaveAttribute("aria-pressed", "false");
  });

  it("exposes price, date, notes, and the correct ID role as accessible names", async () => {
    const user = userEvent.setup();
    render(<TransactionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "Price" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Seller ID front")).toBeInTheDocument();
    expect(screen.getByLabelText("Seller ID back")).toBeInTheDocument();

    await user.click(screen.getByText("Sell"));
    expect(screen.getByLabelText("Buyer ID front")).toBeInTheDocument();
    expect(screen.getByLabelText("Buyer ID back")).toBeInTheDocument();

    await user.click(screen.getByText("More details"));
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
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

    await user.upload(screen.getByLabelText("Seller ID front"), new File(["front"], "front.png", { type: "image/png" }));
    expect(await screen.findByRole("img", { name: "Seller ID front preview" })).toBeInTheDocument();

    await user.click(screen.getByText("Sell"));
    expect(screen.queryByRole("img", { name: "Buyer ID front preview" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Buyer ID front")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
