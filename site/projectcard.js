export class ProjectCard extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.setAttribute("draggable", true)

    let projectID = this.getAttribute("projectID");
    let project = JSON.parse(window.localStorage.getItem("s" + projectID));

    // this.classList.add("project_card");

    let content = document.createElement("div");
    let headline = document.createElement("div");
    headline.classList.add("headline");
    let name = document.createElement("label");
    name.innerHTML = project.name;
    name.classList.add("md-typescale-title-medium")
    headline.append(name);
    content.appendChild(headline);
    let preview = document.createElement("div");
    preview.classList.add("preview");
    preview.style.setProperty("background-image", "url(" + project.preview + ")");
    content.appendChild(preview);
    let ripple = document.createElement("md-ripple");
    ripple.setAttribute("aria-hidden", true);
    content.appendChild(ripple);
    this.appendChild(content);

    this.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", this.getAttribute("projectIndex"))
    });

    this.addEventListener("dragend", (e) => {
    });

    this.addEventListener("dragover", (e) => {
      document.getElementById("project_cards").childNodes.forEach((e) => {
        if (e != this) {
          e.classList.remove("hoverleft", "hoverright", "hoverfolder");
        }
      });
      if (e.offsetX <= 122) {
        this.classList.add("hoverleft");
        this.classList.remove("hoverright", "hoverfolder");
        // } else if (e.offsetX <= 194) {
        //   this.classList.add("hoverfolder");
        //   this.classList.remove("hoverleft", "hoverright");
      } else {
        this.classList.add("hoverright");
        this.classList.remove("hoverleft", "hoverfolder");
      }
      e.preventDefault();
    });
    this.addEventListener("dragleave", (e) => {
      this.classList.remove("hoverleft", "hoverright", "hoverfolder");
    })
    this.addEventListener("drop", (e) => {
      this.classList.remove("hoverleft", "hoverfolder", "hoverright")
      if (e.offsetX <= 122) {
        this.moveProject(
          parseInt(e.dataTransfer.getData("text/plain")),
          parseInt(this.getAttribute("projectIndex")),
        );
      } else {
        this.moveProject(
          parseInt(e.dataTransfer.getData("text/plain")),
          parseInt(this.getAttribute("projectIndex")) + 1,
        );
      }
    })
  }

  setCallbacks(moveProject) {
    this.moveProject = moveProject;
    // this.addInFolder = addInFolder;
  }
}

customElements.define("project-card", ProjectCard);
