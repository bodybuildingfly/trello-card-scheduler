const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-slate-800">Confirm Action</h2>
            <p className="text-slate-600 mb-8">{message}</p>
            <div className="flex justify-end space-x-4">
                <button onClick={onCancel} className="px-5 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300">Cancel</button>
                <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">Confirm</button>
            </div>
        </div>
    </div>
);

export default ConfirmationModal;