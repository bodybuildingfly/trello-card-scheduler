/**
 * @file frontend/src/components/ConfirmationModal.js
 * @description Refactored to use semantic color classes.
 */
const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-surface rounded-xl p-8 shadow-2xl w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">Confirm Action</h2>
            <p className="text-text-secondary mb-8">{message}</p>
            <div className="flex justify-end space-x-4">
                <button onClick={onCancel} className="form-button-secondary">Cancel</button>
                <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-danger text-danger-text font-semibold hover:bg-danger-hover">Confirm</button>
            </div>
        </div>
    </div>
);

export default ConfirmationModal;