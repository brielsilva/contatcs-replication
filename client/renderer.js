window.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const contactsDiv = document.getElementById('contacts');
    const addButton = document.getElementById('add-button');
    const updateButton = document.getElementById('update-button');
    const contactNameInput = document.getElementById('contact-name');
    const contactPhoneInput = document.getElementById('contact-phone');

    function applyChange(changeRequest) {
        const { type, contact } = changeRequest;
        if (type === 'add' || type === 'update') {

          const index = contacts.findIndex(c => c.name === contact.name);
          if (index !== -1) {
            contacts[index] = contact;
          } else {
            contacts.push(contact);
          }
        } else if (type === 'remove') {

          contacts = contacts.filter(c => c.name !== contact.name);
        }
        refreshContactsWithData(contacts);
      }

    let contacts = [];
    window.electronAPI.onContactChanged((changeRequest) => {
        applyChange(changeRequest);
    });

    function refreshContactsWithData(newContacts) {
        contacts = newContacts;
        contactsDiv.innerHTML = '';
        contacts.forEach(contact => {
            let contactDiv = document.createElement('div');
            contactDiv.classList.add('contact-item');

            let detailsDiv = document.createElement('div');
            detailsDiv.classList.add('contact-details');
            detailsDiv.textContent = `Nome: ${contact.name}, Telefone: ${contact.phone}`;

            let actionsDiv = document.createElement('div');
            actionsDiv.classList.add('contact-actions');


            let removeButton = document.createElement('button');
            removeButton.textContent = 'Remover';
            removeButton.addEventListener('click', () => {
                window.electronAPI.removeContact({ name: contact.name }).then(response => {
                    if (response.success) {
                        refreshContacts();
                    } else {
                        alert('Falha ao remover contato: ' + response.message);
                    }
                }).catch(error => {
                    console.error(error);
                    alert('Erro ao remover contato');
                });
            });

            actionsDiv.appendChild(removeButton);
            contactDiv.appendChild(detailsDiv);
            contactDiv.appendChild(actionsDiv);
            contactsDiv.appendChild(contactDiv);
        });
    }


    function refreshContacts() {
        window.electronAPI.getAllContacts().then((contacts) => {
            contactsDiv.innerHTML = '';
            contacts.forEach(contact => {
                let contactDiv = document.createElement('div');
                contactDiv.classList.add('contact-item');

                let detailsDiv = document.createElement('div');
                detailsDiv.classList.add('contact-details');
                detailsDiv.textContent = `Nome: ${contact.name}, Telefone: ${contact.phone}`;

                let actionsDiv = document.createElement('div');
                actionsDiv.classList.add('contact-actions');

    
                let removeButton = document.createElement('button');
                removeButton.textContent = 'Remover';
                removeButton.addEventListener('click', () => {
                    window.electronAPI.removeContact({ name: contact.name }).then(response => {
                        if (response.success) {
                            refreshContacts();
                        } else {
                            alert('Falha ao remover contato: ' + response.message);
                        }
                    }).catch(error => {
                        console.error(error);
                        alert('Erro ao remover contato');
                    });
                });

                actionsDiv.appendChild(removeButton);
                contactDiv.appendChild(detailsDiv);
                contactDiv.appendChild(actionsDiv);
                contactsDiv.appendChild(contactDiv);
            });
        }).catch(error => {
            console.error(error);
            statusDiv.textContent = 'Erro ao recuperar contatos';
        });
    }

    addButton.addEventListener('click', () => {
        let contact = {
            name: contactNameInput.value,
            phone: contactPhoneInput.value
        };
        window.electronAPI.addContact(contact).then(response => {
            if (response.success) {
                refreshContactsWithData(contacts);
                contactNameInput.value = '';
                contactPhoneInput.value = '';
            } else {
                alert('Falha ao adicionar contato: ' + response.message);
            }
        }).catch(error => {
            console.error(error);
            alert('Erro ao adicionar contato');
        });
    });

    updateButton.addEventListener('click', () => {
        let contact = {
            name: contactNameInput.value,
            phone: contactPhoneInput.value
        };
        window.electronAPI.updateContact(contact).then(response => {
            if (response.success) {
                refreshContactsWithData(contacts);
                contactNameInput.value = '';
                contactPhoneInput.value = '';
            } else {
                alert('Falha ao atualizar contato: ' + response.message);
            }
        }).catch(error => {
            console.error(error);
            alert('Erro ao atualizar contato');
        });
    });

    window.electronAPI.onAgendaServiceConnected(() => {
        statusDiv.textContent = 'Conectado ao Serviço de Agenda';
        window.electronAPI.getAllContacts().then((initialContacts) => {
          refreshContactsWithData(initialContacts);
        });
      });
    window.electronAPI.onAgendaServiceDown(() => {
        statusDiv.textContent = 'Serviço de Agenda caiu. Reconectando...';
        contactsDiv.innerHTML = '';
    });
});