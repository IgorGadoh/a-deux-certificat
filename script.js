const form = document.getElementById("certificate-form");
const nameOne = document.getElementById("name-one");
const nameTwo = document.getElementById("name-two");
const dateInput = document.getElementById("wedding-date");
const placeInput = document.getElementById("wedding-place");
const vowInput = document.getElementById("vow");
const consentInput = document.getElementById("symbolic-consent");
const downloadButton = document.getElementById("download-button");
const formError = document.getElementById("form-error");
const invitePanel = document.getElementById("invite-panel");
const createInviteButton = document.getElementById("create-invite");
const inviteLinkBox = document.getElementById("invite-link-box");
const inviteLinkInput = document.getElementById("invite-link");
const inviteStatus = document.getElementById("invite-status");
const copyInviteButton = document.getElementById("copy-invite");
const shareInviteButton = document.getElementById("share-invite");
const secondSignerNotice = document.getElementById("second-signer-notice");
const signaturePads = [
  { canvas: document.getElementById("signature-one"), preview: document.getElementById("preview-signature-one") },
  { canvas: document.getElementById("signature-two"), preview: document.getElementById("preview-signature-two") },
];

const preview = {
  nameOne: document.getElementById("preview-name-one"),
  nameTwo: document.getElementById("preview-name-two"),
  date: document.getElementById("preview-date"),
  place: document.getElementById("preview-place"),
  vow: document.getElementById("preview-vow"),
  signatureNameOne: document.getElementById("signature-name-one"),
  signatureNameTwo: document.getElementById("signature-name-two"),
  signatureLabelOne: document.getElementById("preview-signature-label-one"),
  signatureLabelTwo: document.getElementById("preview-signature-label-two"),
  vowCount: document.getElementById("vow-count"),
};

const signaturesComplete = [false, false];
let secondSignerMode = false;

function formatDate(value) {
  if (!value) return "votre date";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function updatePreview() {
  const firstName = nameOne.value.trim();
  const secondName = nameTwo.value.trim();
  const vow = vowInput.value.trim();

  preview.nameOne.textContent = firstName || "Prénom";
  preview.nameTwo.textContent = secondName || "Prénom";
  preview.date.textContent = formatDate(dateInput.value);
  preview.place.textContent = placeInput.value.trim() || "votre lieu";
  preview.vow.textContent = vow || "écrivez ici la promesse qui vous unit.";
  preview.signatureNameOne.textContent = firstName || "Première personne";
  preview.signatureNameTwo.textContent = secondName || "Deuxième personne";
  preview.signatureLabelOne.textContent = firstName || "Première personne";
  preview.signatureLabelTwo.textContent = secondName || "Deuxième personne";
  preview.vowCount.textContent = String(vowInput.value.length);

  const fieldsComplete = [nameOne, nameTwo, dateInput, placeInput, vowInput]
    .every((field) => field.value.trim().length > 0);
  createInviteButton.disabled = secondSignerMode || !(
    fieldsComplete &&
    signaturesComplete[0] &&
    consentInput.checked
  );
  downloadButton.disabled = !(
    fieldsComplete &&
    signaturesComplete.every(Boolean) &&
    consentInput.checked
  );
}

function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function isValidInvitation(payload) {
  const fields = ["nameOne", "nameTwo", "date", "place", "vow"];
  if (!payload || payload.version !== 1 || payload.symbolicConsent !== true) return false;
  if (!fields.every((field) => typeof payload[field] === "string")) return false;
  if (
    payload.nameOne.length > 60 ||
    payload.nameTwo.length > 60 ||
    payload.place.length > 100 ||
    payload.vow.length > 500
  ) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return false;
  const [year, month, day] = payload.date.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day ||
    typeof payload.firstSignature !== "string" ||
    payload.firstSignature.length > 250000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(payload.firstSignature)
  ) return false;
  return fields.every((field) => payload[field].trim().length > 0);
}

function showInvitationError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function invalidateInvite() {
  if (secondSignerMode) return;
  inviteLinkBox.hidden = true;
  inviteLinkInput.value = "";
  inviteStatus.textContent = "";
}

function loadInvitation() {
  const match = window.location.hash.match(/^#invitation=(.+)$/);
  if (!match) return;
  if (match[1].length > 350000) {
    showInvitationError("Ce lien d’invitation est trop volumineux ou invalide.");
    return;
  }

  try {
    const invitation = decodePayload(match[1]);
    if (!isValidInvitation(invitation)) throw new Error("Invalid invitation data");

    secondSignerMode = true;
    nameOne.value = invitation.nameOne;
    nameTwo.value = invitation.nameTwo;
    dateInput.value = invitation.date;
    placeInput.value = invitation.place;
    vowInput.value = invitation.vow;
    consentInput.checked = true;
    consentInput.disabled = true;
    [nameOne, nameTwo, dateInput, placeInput, vowInput].forEach((field) => {
      if (field.type === "date") field.disabled = true;
      else field.readOnly = true;
    });

    signaturesComplete[0] = true;
    const firstSignature = signaturePads[0];
    const firstSignatureField = firstSignature.canvas.closest(".signature-field");
    firstSignature.preview.src = invitation.firstSignature;
    firstSignature.preview.hidden = false;
    firstSignatureField.classList.add("signed", "locked");
    firstSignatureField.querySelector(".signature-label span").textContent = invitation.nameOne;
    const firstSignatureImage = new Image();
    firstSignatureImage.onload = () => {
      firstSignature.canvas.getContext("2d").drawImage(
        firstSignatureImage,
        0,
        0,
        firstSignature.canvas.width,
        firstSignature.canvas.height,
      );
    };
    firstSignatureImage.src = invitation.firstSignature;

    invitePanel.hidden = true;
    secondSignerNotice.textContent = `${invitation.nameOne} a déjà signé. À votre tour, ${invitation.nameTwo} !`;
    secondSignerNotice.hidden = false;
    document.querySelector(".signatures-section .form-section-heading h3").textContent =
      "À votre tour de signer";
    document.querySelector(".signatures-section .form-section-heading p").textContent =
      "La première signature est conservée. Signez dans le second espace.";
    document.querySelector("#signature-two").closest(".signature-field")
      .querySelector(".signature-label span").textContent = invitation.nameTwo;
    document.querySelector("#signature-two").closest(".signature-field")
      .querySelector(".signature-hint").textContent = "Votre signature";
    downloadButton.innerHTML = '<span aria-hidden="true">↓</span> Enregistrer le certificat signé';
    updatePreview();
  } catch {
    showInvitationError("Ce lien d’invitation est invalide ou incomplet. Demandez à la première personne de vous en envoyer un nouveau.");
  }
}

signaturePads.forEach(({ canvas, preview: signaturePreview }, index) => {
  const context = canvas.getContext("2d");
  let isDrawing = false;
  let strokeDistance = 0;
  let previousPoint = null;
  let signatureSnapshot = null;

  canvas.width = 800;
  canvas.height = 180;
  context.strokeStyle = "#28392e";
  context.lineWidth = 3.2;
  context.lineCap = "round";
  context.lineJoin = "round";

  function pointFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (secondSignerMode && index === 0) return;
    event.preventDefault();
    isDrawing = true;
    strokeDistance = 0;
    signatureSnapshot = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);
    previousPoint = pointFromEvent(event);
    context.beginPath();
    formError.hidden = true;
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const previous = previousPoint;
    strokeDistance += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
    previousPoint = point;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  });

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    context.closePath();
    if (strokeDistance < canvas.width * 0.025) {
      context.putImageData(signatureSnapshot, 0, 0);
      if (signaturesComplete[index]) {
        signaturePreview.src = canvas.toDataURL("image/png");
      }
      updatePreview();
      return;
    }

    signaturesComplete[index] = true;
    canvas.closest(".signature-field").classList.add("signed");
    signaturePreview.src = canvas.toDataURL("image/png");
    signaturePreview.hidden = false;
    invalidateInvite();
    updatePreview();
  }

  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  canvas.addEventListener("lostpointercapture", stopDrawing);
});

document.querySelectorAll(".clear-signature").forEach((button) => {
  button.addEventListener("click", () => {
    const index = signaturePads.findIndex(({ canvas }) => canvas.id === button.dataset.clear);
    if (index < 0 || (secondSignerMode && index === 0)) return;

    const { canvas, preview: signaturePreview } = signaturePads[index];
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    signaturesComplete[index] = false;
    signaturePreview.removeAttribute("src");
    signaturePreview.hidden = true;
    canvas.closest(".signature-field").classList.remove("signed");
    invalidateInvite();
    updatePreview();
  });
});

createInviteButton.addEventListener("click", () => {
  if (createInviteButton.disabled) return;
  formError.hidden = true;

  const payload = {
    version: 1,
    nameOne: nameOne.value.trim(),
    nameTwo: nameTwo.value.trim(),
    date: dateInput.value,
    place: placeInput.value.trim(),
    vow: vowInput.value.trim(),
    symbolicConsent: consentInput.checked,
    firstSignature: signaturePads[0].canvas.toDataURL("image/png"),
  };
  const inviteUrl = new URL(window.location.href);
  inviteUrl.hash = `invitation=${encodePayload(payload)}`;
  inviteLinkInput.value = inviteUrl.toString();
  inviteLinkBox.hidden = false;
  inviteStatus.textContent = "Lien créé. Envoyez-le à la deuxième personne.";
  inviteLinkInput.focus();
  inviteLinkInput.select();
});

copyInviteButton.addEventListener("click", async () => {
  inviteLinkInput.focus();
  inviteLinkInput.select();
  try {
    await navigator.clipboard.writeText(inviteLinkInput.value);
    inviteStatus.textContent = "Lien copié. Vous pouvez l’envoyer à la deuxième personne.";
  } catch {
    inviteStatus.textContent = "La copie automatique n’est pas disponible ici. Le lien est sélectionné : copiez-le avec Ctrl+C ou ⌘C.";
  }
});

if (typeof navigator.share === "function") {
  shareInviteButton.hidden = false;
}

shareInviteButton.addEventListener("click", async () => {
  if (!inviteLinkInput.value) return;
  try {
    await navigator.share({
      title: "Votre certificat de mariage — À Deux",
      text: "À ton tour de signer notre certificat !",
      url: inviteLinkInput.value,
    });
    inviteStatus.textContent = "Lien partagé.";
  } catch (error) {
    if (error.name !== "AbortError") {
      inviteStatus.textContent = "Le partage n’a pas abouti. Vous pouvez copier le lien à la place.";
    }
  }
});

form.addEventListener("input", () => {
  invalidateInvite();
  updatePreview();
});
form.addEventListener("change", () => {
  invalidateInvite();
  updatePreview();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.hidden = true;

  if (!form.reportValidity()) return;
  if (!signaturesComplete.every(Boolean)) {
    showInvitationError("Les deux personnes doivent signer avant de créer le certificat.");
    return;
  }

  window.print();
});

window.addEventListener("beforeprint", updatePreview);
loadInvitation();
updatePreview();
