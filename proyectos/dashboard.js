const viewTitles = {
  clients: "Clientes",
  suppliers: "Proveedores",
  inventory: "Existencias",
  journal: "Asientos contables",
  "petty-cash": "Caja chica",
  bank: "Banco"
};

const overview = document.querySelector("#overview");
const inventoryPanel = document.querySelector("#inventoryPanel");
const modulePanel = document.querySelector("#modulePanel");
const moduleTitle = document.querySelector("#moduleTitle");
const navigationButtons = document.querySelectorAll("[data-view]");

for (const button of navigationButtons) {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    const isOverview = view === "overview";
    const isInventory = view === "inventory";

    overview.hidden = !isOverview;
    inventoryPanel.hidden = !isInventory;
    modulePanel.hidden = isOverview || isInventory;
    if (!isOverview) moduleTitle.textContent = viewTitles[view];

    for (const navigationButton of navigationButtons) {
      const isActive = navigationButton === button;
      navigationButton.classList.toggle("active", isActive);
      if (isActive) navigationButton.setAttribute("aria-current", "page");
      else navigationButton.removeAttribute("aria-current");
    }

    document.querySelector("#mainNavigation .navbar-collapse")?.classList.remove("show");
  });
}
