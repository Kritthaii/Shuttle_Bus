import React, { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import axios from "axios";

function UsersManage() {
  const { me } = useAuth();
  const perms = me?.permissions ?? [];

  const [employee, setEmployee] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    username: "",
    password: "",
    department: "",
    position: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [employeeAll, setEmployeeAll] = useState([]);

  const fetchEmp = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/employee");
      setEmployee(res.data);
      setEmployeeAll(res.data);
    } catch (err) {
      console.log(err);
    }
  };
  const fetchDepartment = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/department");
      setDepartments(res.data);
    } catch (err) {
      console.log(err);
    }
  };
  const fetchPositions = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/position");
      setPositions(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchEmp();
    fetchDepartment();
    fetchPositions();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const department = Number(form.department);
    const position = Number(form.position);

    if (!form.firstname || !form.lastname || !form.username || !form.password || !department || !position) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/employees/${editingId}`, form);
        alert("แก้ไขพนักงานเรียบร้อย");
        setEditingId(null);
      } else {
        await axios.post("http://localhost:5000/api/employees", {
          ...form,
          department,
          position,
        });
        alert("เพิ่มพนักงานเรียบร้อย");
      }
      setForm({
        firstname: "",
        lastname: "",
        username: "",
        password: "",
        department: "",
        position: "",
      });
      fetchEmp();
    } catch (err) {
      console.log(err);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();  // รับคำค้นหาและแปลงเป็นตัวพิมพ์เล็ก
    setSearchQuery(query);  // ตั้งค่า searchQuery ให้กับคำค้นหาจากผู้ใช้
    if(!query){
      setEmployeeAll(employeeAll);
    }

    // กรองข้อมูลที่ตรงกับคำค้นหาจากหลายฟิลด์
    const filteredData = employee.filter((emp) => {
      return (
        emp.EMPLOYEEID.toString().includes(query) ||  // ค้นหาจาก employeeId
        emp.FIRSTNAME.toLowerCase().includes(query) ||  // ค้นหาจากชื่อ
        emp.LASTNAME.toLowerCase().includes(query) ||  // ค้นหาจากนามสกุล
        emp.DEPTNAME.toLowerCase().includes(query) ||  // ค้นหาจากแผนก
        emp.POSITIONNAME.toLowerCase().includes(query)  // ค้นหาจากตำแหน่ง
      );
    });

    setEmployee(filteredData);  // แสดงผลลัพธ์การค้นหาที่กรองแล้ว
  };

  const handleEdit = (emp) => {
    setForm({
      firstname: emp.FIRSTNAME,
      lastname: emp.LASTNAME,
      username: emp.USERNAME,
      password: emp.PASSWORD_HASH,
      department: emp.DEPTNAME,
      position: emp.POSITIONNAME,
    });
    setEditingId(emp.EMPLOYEEID);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/employees/${id}`);
      alert("ลบพนักงานเรียบร้อย");
      fetchEmp();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">จัดการพนักงาน</h1>
      <p className="text-gray-600 mb-6">เพิ่ม / แก้ไข / ลบ พนักงาน</p>
            
            <div className="relative w-full max-w-md mb-4">
  <svg
    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>

  <input
    type="search"
    placeholder="Search"
    value={searchQuery}
    onChange={handleSearch}
    className="w-full rounded-xl border border-zinc-300 bg-white/80 pl-10 pr-12 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm
               focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition
               hover:border-zinc-400
               dark:bg-zinc-900/70 dark:text-zinc-100 dark:border-zinc-700 dark:placeholder:text-zinc-500"
  />

  {searchQuery && (
    <button
      type="button"
      onClick={() => setSearchQuery("")}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100
                 dark:text-zinc-300 dark:hover:bg-zinc-800"
      aria-label="ล้างคำค้นหา"
    >
      เคลียร์
    </button>
  )}
</div>
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-lg p-6 mb-8 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Firstname</label>
            <input
              type="text"
              name="firstname"
              value={form.firstname}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Lastname</label>
            <input
              type="text"
              name="lastname"
              value={form.lastname}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Department</label>
            <select
              name="department"
              value={form.department}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            >
              <option value="">เลือกแผนก</option>
              {departments.map((dept) => (
                <option key={dept.DEPARTMENTID} value={dept.DEPARTMENTID}>
                  {dept.DEPTNAME}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Position</label>
            <select
              name="position"
              value={form.position}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            >
              <option value="">เลือกตำแหน่ง</option>
              {positions.map((post) => (
                <option key={post.POSITIONID} value={post.POSITIONID}>
                  {post.POSITIONNAME}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded shadow"
        >
          {editingId ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
        </button>
        
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse bg-white shadow rounded-lg">
          <thead>
            <tr className="bg-gray-100 text-left text-sm uppercase text-gray-600">
              <th className="p-3 border-b">ID</th>
              <th className="p-3 border-b">Firstname</th>
              <th className="p-3 border-b">Lastname</th>
              <th className="p-3 border-b">Username</th>
              <th className="p-3 border-b">Password</th>
              <th className="p-3 border-b">Department</th>
              <th className="p-3 border-b">Position</th>
              <th className="p-3 border-b">Account ID</th>
              <th className="p-3 border-b text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employee.map((emp) => (
              <tr key={emp.EMPLOYEEID} className="hover:bg-gray-50">
                <td className="p-3 border-b">{emp.EMPLOYEEID}</td>
                <td className="p-3 border-b">{emp.FIRSTNAME}</td>
                <td className="p-3 border-b">{emp.LASTNAME}</td>
                <td className="p-3 border-b">{emp.USERNAME}</td>
                <td className="p-3 border-b">{emp.PASSWORD_HASH}</td>
                <td className="p-3 border-b">{emp.DEPTNAME}</td>
                <td className="p-3 border-b">{emp.POSITIONNAME}</td>
                <td className="p-3 border-b">{emp.ACCOUNT_ID}</td>
                <td className="p-3 border-b text-center space-x-2">
                  <button
                    onClick={() => handleEdit(emp)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(emp.EMPLOYEEID)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {employee.length === 0 && (
              <tr>
                <td colSpan="9" className="text-center py-4 text-gray-500">
                  ไม่มีข้อมูลพนักงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



export default UsersManage;







