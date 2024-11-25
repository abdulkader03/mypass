import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Vault = () => {
    const [items, setItems] = useState([]);
    const [formData, setFormData] = useState({ type: "Login", data: {} });
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [unmaskedFields, setUnmaskedFields] = useState({});
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user"));

    const AUTO_LOCK_TIME =  30 * 1000; // 5 minutes in milliseconds
    let activityTimeout;

    if (!user) {
        navigate("/login");
    }

    const typeFields = {
        Login: ["Site/Store Name", "Username", "Password", "URL"],
        CreditCard: ["Card Type", "Card Number", "Expiry Date", "CVV"],
        Identity: ["Full Name", "ID Number", "Date of Birth"],
        SecureNote: ["Title", "Note"],
    };

    useEffect(() => {
        fetchItems();
        startInactivityTimer();

        // Listen for user activity
        document.addEventListener("mousemove", resetInactivityTimer);
        document.addEventListener("keypress", resetInactivityTimer);
        document.addEventListener("click", resetInactivityTimer);

        return () => {
            // Cleanup event listeners and timer
            clearTimeout(activityTimeout);
            document.removeEventListener("mousemove", resetInactivityTimer);
            document.removeEventListener("keypress", resetInactivityTimer);
            document.removeEventListener("click", resetInactivityTimer);
        };
    }, []);

    const startInactivityTimer = () => {
        activityTimeout = setTimeout(() => {
            handleAutoLock();
        }, AUTO_LOCK_TIME);
    };

    const resetInactivityTimer = () => {
        clearTimeout(activityTimeout);
        startInactivityTimer();
    };

    const handleAutoLock = () => {
        alert("You have been logged out due to inactivity.");
        localStorage.removeItem("user"); // Clear user session
        navigate("/login"); // Redirect to login page
    };

    const fetchItems = async () => {
        try {
            const response = await axios.post("http://localhost/mypass/vault.php", {
                action: "read",
                user_id: user.id,
            });
            if (response.data.success) {
                setItems(response.data.items);
            }
        } catch (error) {
            console.error("Error fetching items:", error);
        }
    };

    const handleCreateOrUpdate = async (e) => {
        e.preventDefault();
        const action = isEditing ? "update" : "create";

        try {
            const response = await axios.post("http://localhost/mypass/vault.php", {
                action,
                user_id: user.id,
                id: editId,
                type: formData.type,
                data: formData.data,
            });

            if (response.data.success) {
                fetchItems();
                setFormData({ type: "Login", data: {} });
                setIsEditing(false);
                setEditId(null);
            }
        } catch (error) {
            console.error(`Error ${action}ing item:`, error);
        }
    };

    const handleDelete = async (id) => {
        try {
            const response = await axios.post("http://localhost/mypass/vault.php", {
                action: "delete",
                user_id: user.id,
                id,
            });

            if (response.data.success) {
                fetchItems();
            }
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };

    const handleEdit = (item) => {
        setFormData({ type: item.type, data: JSON.parse(item.data) });
        setIsEditing(true);
        setEditId(item.id);
    };

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            data: { ...prev.data, [field]: value },
        }));
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                alert(`Copied to clipboard: ${text}`);
            })
            .catch((err) => {
                console.error("Failed to copy: ", err);
            });
    };

    const toggleMask = (itemId, field) => {
        setUnmaskedFields((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: !prev[itemId]?.[field],
            },
        }));
    };

    const isUnmasked = (itemId, field) => unmaskedFields[itemId]?.[field];

    return (
        <div>
            <h2>Vault</h2>
            <button onClick={() => navigate("/login")} style={{ marginBottom: "20px" }}>
                Logout
            </button>

            <form onSubmit={handleCreateOrUpdate}>
                <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                    {Object.keys(typeFields).map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>

                {typeFields[formData.type].map((field) => (
                    <div key={field} style={{ marginBottom: "10px" }}>
                        <label>{field}:</label>
                        <input
                            type="text"
                            value={formData.data[field] || ""}
                            onChange={(e) => handleInputChange(field, e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => handleCopy(formData.data[field] || "")}
                            style={{ marginLeft: "10px" }}
                        >
                            Copy
                        </button>
                    </div>
                ))}

                <button type="submit">{isEditing ? "Update" : "Create"} Item</button>
            </form>

            <h3>Items</h3>
            <ul>
                {items.map((item) => {
                    const itemData = JSON.parse(item.data);

                    return (
                        <li key={item.id} style={{ marginBottom: "15px" }}>
                            <strong>{item.type}:</strong>
                            {Object.entries(itemData).map(([key, value]) => (
                                <div key={key} style={{ display: "flex", alignItems: "center", marginTop: "5px" }}>
                                    <span style={{ marginRight: "10px" }}>
                                        {key}:{" "}
                                        {isUnmasked(item.id, key) ? (
                                            value
                                        ) : (
                                            "****"
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => toggleMask(item.id, key)}
                                        style={{ marginLeft: "10px" }}
                                    >
                                        {isUnmasked(item.id, key) ? "Mask" : "Unmask"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(value)}
                                        style={{ marginLeft: "10px" }}
                                    >
                                        Copy
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => handleEdit(item)} style={{ marginRight: "10px" }}>Edit</button>
                            <button onClick={() => handleDelete(item.id)}>Delete</button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default Vault;