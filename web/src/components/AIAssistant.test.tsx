import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AIAssistant, AIAssistantButton } from "./AIAssistant";
import { ai, ApiError } from "../lib/api";

// Mock the API
vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    ai: {
      interpret: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
    },
  };
});

// Mock useAuth
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com", currency: "USD" },
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Helper to get the textarea
const getPromptInput = () => screen.getByRole("textbox");

describe("AIAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<AIAssistant isOpen={false} onClose={() => {}} />, {
      wrapper: createWrapper(),
    });
    expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
  });

  it("renders modal when open", () => {
    render(<AIAssistant isOpen={true} onClose={() => {}} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(getPromptInput()).toBeInTheDocument();
  });

  it("shows loading state while processing", async () => {
    (ai.interpret as Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AIAssistant isOpen={true} onClose={() => {}} />, {
      wrapper: createWrapper(),
    });

    const input = getPromptInput();
    fireEvent.change(input, { target: { value: "Put coffee in Food" } });

    const button = screen.getByRole("button", { name: /preview changes/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
  });

  it("shows preview after interpretation", async () => {
    (ai.interpret as Mock).mockResolvedValue({
      data: {
        commandId: "cmd-1",
        interpretation: "Put coffee transactions in Food category",
        preview: {
          matchCount: 2,
          records: [
            {
              id: "tx-1",
              description: "Morning coffee",
              amount: "5.00",
              date: "2026-02-20",
              categoryId: null,
              categoryName: null,
              type: "expense" as const,
            },
          ],
        },
        changes: {
          categoryId: "cat-food",
          categoryName: "Food",
        },
        expiresIn: 300,
      },
    });

    render(<AIAssistant isOpen={true} onClose={() => {}} />, {
      wrapper: createWrapper(),
    });

    const input = getPromptInput();
    fireEvent.change(input, { target: { value: "Put coffee in Food" } });

    const button = screen.getByRole("button", { name: /preview changes/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/will update 2 transaction/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Morning coffee")).toBeInTheDocument();
    // Check that Food category is shown in the changes summary
    expect(screen.getByText(/Category → Food/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm update/i })).toBeInTheDocument();
  });

  it("shows success message after confirmation", async () => {
    (ai.interpret as Mock).mockResolvedValue({
      data: {
        commandId: "cmd-1",
        interpretation: "Test",
        preview: {
          matchCount: 1,
          records: [
            {
              id: "tx-1",
              description: "Test",
              amount: "10.00",
              date: "2026-02-20",
              categoryId: null,
              categoryName: null,
              type: "expense" as const,
            },
          ],
        },
        changes: { categoryId: "cat-1", categoryName: "Test" },
        expiresIn: 300,
      },
    });

    (ai.confirm as Mock).mockResolvedValue({
      data: {
        commandId: "cmd-1",
        status: "confirmed",
        result: {
          updatedCount: 1,
          transactions: [{ id: "tx-1", description: "Test", category: "Test" }],
        },
      },
    });

    render(<AIAssistant isOpen={true} onClose={() => {}} />, {
      wrapper: createWrapper(),
    });

    // Enter prompt and submit
    const input = getPromptInput();
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /preview changes/i }));

    // Wait for preview
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm update/i })).toBeInTheDocument();
    });

    // Confirm
    fireEvent.click(screen.getByRole("button", { name: /confirm update/i }));

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
      expect(screen.getByText(/updated 1 transaction/i)).toBeInTheDocument();
    });
  });

  it("shows error message on failure", async () => {
    (ai.interpret as Mock).mockRejectedValue(
      new ApiError(400, { error: "No matching transactions" })
    );

    render(<AIAssistant isOpen={true} onClose={() => {}} />, {
      wrapper: createWrapper(),
    });

    const input = getPromptInput();
    fireEvent.change(input, { target: { value: "Invalid query" } });
    fireEvent.click(screen.getByRole("button", { name: /preview changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("resets state when closed and reopened", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<AIAssistant isOpen={true} onClose={onClose} />, {
      wrapper: createWrapper(),
    });

    // Enter some text
    const input = getPromptInput();
    fireEvent.change(input, { target: { value: "Some text" } });

    // Close the modal
    rerender(<AIAssistant isOpen={false} onClose={onClose} />);

    // Reopen
    rerender(<AIAssistant isOpen={true} onClose={onClose} />);

    // Input should be empty
    const newInput = getPromptInput() as HTMLTextAreaElement;
    expect(newInput.value).toBe("");
  });
});

describe("AIAssistantButton", () => {
  it("renders floating button", () => {
    render(<AIAssistantButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /open ai assistant/i })).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<AIAssistantButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
