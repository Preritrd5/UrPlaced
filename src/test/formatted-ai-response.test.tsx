import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FormattedAIResponse, formatInlineText } from "@/components/ai/formatted-ai-response";

describe("FormattedAIResponse Component", () => {
  it("renders headings with appropriate hierarchy and classes", () => {
    const markdown = `# Main Title
## Section Heading
### Subsection Heading
#### Mini Heading`;

    const { container } = render(<FormattedAIResponse content={markdown} />);

    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe("Main Title");
    expect(h1?.className).toContain("font-outfit");

    const h2 = container.querySelector("h2");
    expect(h2).not.toBeNull();
    expect(h2?.textContent).toBe("Section Heading");

    const h3 = container.querySelector("h3");
    expect(h3).not.toBeNull();
    expect(h3?.textContent).toBe("Subsection Heading");

    const h4 = container.querySelector("h4");
    expect(h4).not.toBeNull();
    expect(h4?.textContent).toBe("Mini Heading");
  });

  it("renders standard Markdown tables into HTML table elements with alternating rows", () => {
    const markdown = `### Comparison Summary

| Algorithm | Best Case | Average Case | Worst Case | Space Complexity |
|:---|:---|:---|:---|:---|
| **QuickSort** | O(n log n) | O(n log n) | O(n^2) | O(log n) |
| **MergeSort** | O(n log n) | O(n log n) | O(n log n) | O(n) |`;

    const { container } = render(<FormattedAIResponse content={markdown} />);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(5);
    expect(headers[0].textContent).toBe("Algorithm");
    expect(headers[1].textContent).toBe("Best Case");
    expect(headers[4].textContent).toBe("Space Complexity");

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);

    const firstRowCells = rows[0].querySelectorAll("td");
    expect(firstRowCells[0].textContent).toBe("QuickSort");
    expect(firstRowCells[0].querySelector("strong")).not.toBeNull();
  });

  it("renders code blocks with language header and copy button", () => {
    const markdown = `Here is a solution:

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    return arr
\`\`\``;

    const { container } = render(<FormattedAIResponse content={markdown} />);

    const code = container.querySelector("pre code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain("def quicksort(arr):");

    const langBadge = screen.getByText("Python");
    expect(langBadge).not.toBeNull();

    const copyBtn = screen.getByRole("button", { name: /copy code snippet/i });
    expect(copyBtn).not.toBeNull();

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("def quicksort(arr):"));
  });

  it("renders unordered and ordered lists with styled markers and continuation lines", () => {
    const markdown = `* **Best Case & Average Case: O(n log n)**
  This occurs when the pivot divides the array equally.
* **Worst Case: O(n^2)**
  This occurs when the pivot is poorly chosen.

1. **Divide:** Recursively divide array.
2. **Conquer:** Merge sorted subarrays.`;

    const { container } = render(<FormattedAIResponse content={markdown} />);

    const ul = container.querySelector("ul");
    expect(ul).not.toBeNull();
    const ulItems = ul?.querySelectorAll("li");
    expect(ulItems?.length).toBe(2);
    expect(ulItems?.[0].textContent).toContain("Best Case & Average Case");
    expect(ulItems?.[0].textContent).toContain("This occurs when the pivot divides");

    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    const olItems = ol?.querySelectorAll("li");
    expect(olItems?.length).toBe(2);
    expect(olItems?.[0].textContent).toContain("Divide:");
    expect(olItems?.[1].textContent).toContain("Conquer:");
  });

  it("renders blockquote callouts", () => {
    const markdown = `> **Key Interview Takeaway:** MergeSort guarantees O(n log n) at the cost of O(n) auxiliary memory.`;

    const { container } = render(<FormattedAIResponse content={markdown} />);

    const callout = container.querySelector(".border-l-4");
    expect(callout).not.toBeNull();
    expect(callout?.textContent).toContain("Key Interview Takeaway:");
  });

  it("renders Big-O complexity badges for computational complexities", () => {
    const markdown = `The average time is O(n log n), while worst-case is O(n^2) and lookup is O(1).`;

    const { container } = render(<FormattedAIResponse content={markdown} />);

    const badges = container.querySelectorAll("span[title^='Computational Complexity']");
    expect(badges.length).toBe(3);
    expect(badges[0].textContent).toContain("O(n log n)");
    expect(badges[1].textContent).toContain("O(n²)");
    expect(badges[2].textContent).toContain("O(1)");
  });

  it("renders standalone bold headers prominently", () => {
    const markdown = `**Time Complexity:**

* Item 1
* Item 2

**Key Takeaways:**

Some summary here.`;

    const { container } = render(<FormattedAIResponse content={markdown} />);

    expect(screen.getByText("Time Complexity:")).not.toBeNull();
    expect(screen.getByText("Key Takeaways:")).not.toBeNull();
  });

  it("handles complex educational responses matching user screenshots without breaking", () => {
    const userScreenshotResponse = `**Time Complexity:**

* **Best Case & Average Case: O(n log n)**
  This occurs when the pivot selection consistently divides the array into roughly equal halves. Each partitioning step takes O(n) time (to iterate through the elements), and there are O(log n) such partitioning levels (like a binary tree).
* **Worst Case: O(n^2)**
  This happens when the pivot selection is consistently poor, for example, always picking the smallest or largest element. In this scenario, the partitioning step doesn't divide the array effectively, leading to one sub-array of size n-1 and another of size 0. This results in n levels of recursion, with each level taking O(n) work, hence O(n^2).

**Why O(n log n) on average?** Imagine a balanced binary tree where each level represents a partitioning step. The height of this tree is log n, and at each level, we do O(n) work to partition.

**Why O(n^2) in the worst case?** Imagine a degenerate tree (like a linked list) where each partitioning step only reduces the problem size by one element. The height becomes n, and we still do O(n) work at each level.

### MergeSort

**Intuition:** MergeSort is also a "divide and conquer" algorithm, but it approaches the problem differently:
1. **Divide:** It recursively divides the array into two halves until each sub-array contains only one element (which is considered sorted).
2. **Conquer (Merge):** It then repeatedly merges these sorted sub-arrays to produce new sorted sub-arrays until there is only one sorted array remaining. The key operation here is the \`merge\` function, which takes two sorted arrays and combines them into a single sorted array.

### Comparison Summary

| Algorithm | Best Case | Average Case | Worst Case | Space Complexity |
|:---|:---|:---|:---|:---|
| **QuickSort** | O(n log n) | O(n log n) | O(n^2) | O(log n) (average, for recursion stack) / O(n) (worst) |
| **MergeSort** | O(n log n) | O(n log n) | O(n log n) | O(n) (for the auxiliary array used in merging) |

**Key Takeaways:**

* **QuickSort** is often faster in practice due to better cache performance and lower constant factors, *provided* the pivot selection is good. However, its O(n^2) worst-case is a significant drawback for applications where guaranteed performance is critical.
* **MergeSort** offers guaranteed O(n log n) performance in all cases, making it more predictable. Its main disadvantage is the O(n) auxiliary space requirement for the merge operation.`;

    const { container } = render(<FormattedAIResponse content={userScreenshotResponse} />);

    // Verify Table rendered
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(container.querySelectorAll("th").length).toBe(5);
    expect(container.querySelectorAll("tbody tr").length).toBe(2);

    // Verify Headings
    const h3Heading = container.querySelector("h3");
    expect(h3Heading?.textContent).toBe("MergeSort");
    expect(screen.getByText("Comparison Summary")).not.toBeNull();

    // Verify Lists
    expect(container.querySelectorAll("ul").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll("ol").length).toBe(1);

    // Verify Inline Code
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("merge");

    // Verify Big-O complexity badges
    const badges = container.querySelectorAll("span[title^='Computational Complexity']");
    expect(badges.length).toBeGreaterThanOrEqual(10);
  });
});
